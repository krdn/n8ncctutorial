/**
 * Credential 변환 모듈
 * @description 워크플로우 내 credential ID를 환경에 맞게 변환하는 기능
 */

import type { Config, CredentialTransform } from '../types/config.js';
import type { N8nNode, N8nWorkflowDetail } from '../types/n8n.js';
import { buildCredentialTransform } from '../config/credentials.js';

/**
 * 노드 내 credential 정보 타입
 * @description n8n 노드의 credentials 필드에 저장되는 구조
 */
export interface NodeCredentialInfo {
  /** credential ID */
  id: string;
  /** credential 이름 */
  name: string;
}

/**
 * 변환 통계
 * @description credential 변환 작업의 결과 통계
 */
export interface TransformStats {
  /** 처리된 노드 수 */
  nodesProcessed: number;
  /** 변환된 credential 수 */
  credentialsTransformed: number;
  /** 변환 맵에 없는 credential ID 목록 */
  credentialsUnmapped: string[];
}

/**
 * 워크플로우 변환 결과
 * @description transformCredentialsInWorkflow의 반환 타입
 */
export interface TransformResult {
  /** 변환된 워크플로우 */
  workflow: N8nWorkflowDetail;
  /** 변환 통계 */
  stats: TransformStats;
}

/**
 * 노드 변환 결과
 * @description transformNodeCredentials의 반환 타입
 */
export interface NodeTransformResult {
  /** 변환된 노드 */
  node: N8nNode;
  /** 변환된 credential 수 */
  transformed: number;
  /** 변환 맵에 없는 credential ID 목록 */
  unmapped: string[];
}

/**
 * credential 객체에서 ID 추출
 * @description credentials 객체의 값에서 id 필드 추출
 * @param credential - credentials 객체의 개별 값
 * @returns credential ID 또는 null
 *
 * @example
 * const cred = { id: "1", name: "Slack" };
 * extractCredentialId(cred); // "1"
 */
export function extractCredentialId(credential: unknown): string | null {
  if (typeof credential !== 'object' || credential === null) {
    return null;
  }

  const credObj = credential as Record<string, unknown>;

  if ('id' in credObj) {
    const id = credObj.id;
    if (typeof id === 'string') {
      return id;
    }
    if (typeof id === 'number') {
      return String(id);
    }
  }

  return null;
}

/**
 * 노드의 credentials 변환
 * @description 단일 노드 내 모든 credential ID를 변환 맵에 따라 변환
 * @param node - 원본 노드
 * @param credentialTransform - credential 변환 맵
 * @returns 변환된 노드와 통계
 *
 * @example
 * const result = transformNodeCredentials(slackNode, credentialTransform);
 * console.log(result.transformed); // 1
 * console.log(result.unmapped); // []
 */
export function transformNodeCredentials(
  node: N8nNode,
  credentialTransform: CredentialTransform
): NodeTransformResult {
  // credentials가 없는 노드는 그대로 반환
  if (!node.credentials) {
    return {
      node,
      transformed: 0,
      unmapped: [],
    };
  }

  // credential ID 매핑 맵 생성 (빠른 조회용)
  const idMap = new Map<string, string>();
  for (const mapping of credentialTransform.mappings) {
    idMap.set(mapping.originalId, mapping.newId);
  }

  const transformedCredentials: Record<string, unknown> = {};
  let transformed = 0;
  const unmapped: string[] = [];

  // 각 credential 변환
  for (const [key, value] of Object.entries(node.credentials)) {
    const originalId = extractCredentialId(value);

    if (originalId === null) {
      // ID 추출 불가 - 원본 유지
      transformedCredentials[key] = value;
      continue;
    }

    if (idMap.has(originalId)) {
      // 매핑 존재 - 새 ID로 교체
      const credObj = value as Record<string, unknown>;
      transformedCredentials[key] = {
        ...credObj,
        id: idMap.get(originalId),
      };
      transformed++;
    } else {
      // 매핑 없음 - 원본 유지, unmapped에 추가
      transformedCredentials[key] = value;
      unmapped.push(originalId);
    }
  }

  return {
    node: {
      ...node,
      credentials: transformedCredentials,
    },
    transformed,
    unmapped,
  };
}

/**
 * 워크플로우 내 모든 노드의 credentials 변환
 * @description 워크플로우 전체를 순회하며 credential ID 변환 수행
 * @param workflow - 원본 워크플로우
 * @param credentialTransform - credential 변환 맵
 * @returns 변환된 워크플로우와 통계
 *
 * @example
 * const result = transformCredentialsInWorkflow(workflow, credentialTransform);
 * console.log(`Transformed: ${result.stats.credentialsTransformed}`);
 * if (result.stats.credentialsUnmapped.length > 0) {
 *   console.warn('Unmapped credentials:', result.stats.credentialsUnmapped);
 * }
 */
export function transformCredentialsInWorkflow(
  workflow: N8nWorkflowDetail,
  credentialTransform: CredentialTransform
): TransformResult {
  const transformedNodes: N8nNode[] = [];
  let totalTransformed = 0;
  const allUnmapped: string[] = [];

  // 모든 노드 순회하며 변환
  for (const node of workflow.nodes) {
    const result = transformNodeCredentials(node, credentialTransform);
    transformedNodes.push(result.node);
    totalTransformed += result.transformed;
    allUnmapped.push(...result.unmapped);
  }

  // 중복 제거된 unmapped 목록
  const uniqueUnmapped = [...new Set(allUnmapped)];

  return {
    workflow: {
      ...workflow,
      nodes: transformedNodes,
    },
    stats: {
      nodesProcessed: workflow.nodes.length,
      credentialsTransformed: totalTransformed,
      credentialsUnmapped: uniqueUnmapped,
    },
  };
}

/**
 * 설정에서 credential 변환 맵 생성
 * @description Config 객체와 환경 이름으로 CredentialTransform 생성하는 편의 함수
 * @param config - 전체 설정 객체
 * @param sourceEnv - 소스 환경 이름
 * @param targetEnv - 대상 환경 이름
 * @returns credential 변환 맵
 *
 * @example
 * const transform = createCredentialTransformFromConfig(config, 'dev', 'prod');
 * const result = transformCredentialsInWorkflow(workflow, transform);
 */
export function createCredentialTransformFromConfig(
  config: Config,
  sourceEnv: string,
  targetEnv: string
): CredentialTransform {
  return buildCredentialTransform(config, sourceEnv, targetEnv);
}
