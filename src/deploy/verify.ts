/**
 * 배포 검증 모듈
 * @description 배포된 워크플로우 검증 기능 구현
 */

import type { N8nApiClient } from '../api/client.js';
import type { N8nWorkflowDetail } from '../types/n8n.js';
import type { DeployedWorkflow } from './types.js';

/**
 * 단일 워크플로우 검증 결과
 */
export interface VerificationResult {
  /** 워크플로우 ID */
  workflowId: string;
  /** 워크플로우 이름 */
  workflowName: string;
  /** 워크플로우 존재 여부 */
  exists: boolean;
  /** 워크플로우 활성화 상태 */
  active: boolean;
  /** 워크플로우 노드 수 */
  nodeCount: number;
  /** 에러 메시지 (존재하지 않거나 조회 실패 시) */
  error?: string;
}

/**
 * 배포 검증 요약
 */
export interface VerificationSummary {
  /** 전체 검증 대상 수 */
  total: number;
  /** 검증 성공 수 */
  verified: number;
  /** 검증 실패 수 */
  failed: number;
  /** 개별 검증 결과 목록 */
  results: VerificationResult[];
}

/**
 * 워크플로우 비교 결과
 */
export interface WorkflowCompareResult {
  /** 일치 여부 */
  match: boolean;
  /** 차이점 목록 */
  differences: string[];
}

/**
 * 단일 워크플로우 검증
 * @description 대상 환경에서 워크플로우 존재 및 상태 확인
 * @param client - n8n API 클라이언트
 * @param workflowId - 검증할 워크플로우 ID
 * @returns 검증 결과
 */
export async function verifyWorkflow(
  client: N8nApiClient,
  workflowId: string
): Promise<VerificationResult> {
  try {
    const workflow = await client.getWorkflow(workflowId);

    return {
      workflowId: workflow.id,
      workflowName: workflow.name,
      exists: true,
      active: workflow.active,
      nodeCount: workflow.nodes?.length ?? 0,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    return {
      workflowId,
      workflowName: '',
      exists: false,
      active: false,
      nodeCount: 0,
      error: errorMessage,
    };
  }
}

/**
 * 배포 결과 검증
 * @description 배포된 모든 워크플로우가 대상 환경에 존재하는지 확인
 * @param client - n8n API 클라이언트 (대상 환경)
 * @param deployedWorkflows - 배포된 워크플로우 목록
 * @returns 검증 요약
 */
export async function verifyDeployment(
  client: N8nApiClient,
  deployedWorkflows: DeployedWorkflow[]
): Promise<VerificationSummary> {
  const results: VerificationResult[] = [];
  let verified = 0;
  let failed = 0;

  // 각 배포된 워크플로우에 대해 검증 수행
  for (const deployed of deployedWorkflows) {
    // skipped 워크플로우는 검증 대상이지만 targetId가 유효해야 함
    if (deployed.action === 'skipped') {
      // skipped인 경우 targetId가 존재하면 검증, 아니면 건너뜀
      if (deployed.targetId && deployed.targetId !== '(dry-run)') {
        const result = await verifyWorkflow(client, deployed.targetId);
        results.push(result);

        if (result.exists) {
          verified++;
        } else {
          failed++;
        }
      } else {
        // dry-run이나 유효하지 않은 targetId는 검증 성공으로 처리
        results.push({
          workflowId: deployed.targetId || deployed.workflowId,
          workflowName: deployed.workflowName,
          exists: true,
          active: false,
          nodeCount: 0,
        });
        verified++;
      }
    } else {
      // created 또는 updated인 경우 검증
      const result = await verifyWorkflow(client, deployed.targetId);
      results.push(result);

      if (result.exists) {
        verified++;
      } else {
        failed++;
      }
    }
  }

  return {
    total: deployedWorkflows.length,
    verified,
    failed,
    results,
  };
}

/**
 * 워크플로우 비교
 * @description 두 워크플로우의 구조와 내용 비교
 * @param source - 소스 워크플로우
 * @param target - 대상 워크플로우
 * @returns 비교 결과
 */
export function compareWorkflows(
  source: N8nWorkflowDetail,
  target: N8nWorkflowDetail
): WorkflowCompareResult {
  const differences: string[] = [];

  // 이름 비교
  if (source.name !== target.name) {
    differences.push(`이름 불일치: "${source.name}" vs "${target.name}"`);
  }

  // 노드 수 비교
  const sourceNodeCount = source.nodes?.length ?? 0;
  const targetNodeCount = target.nodes?.length ?? 0;

  if (sourceNodeCount !== targetNodeCount) {
    differences.push(`노드 수 불일치: ${sourceNodeCount} vs ${targetNodeCount}`);
  }

  // 노드 타입 비교 (순서 무관)
  if (source.nodes && target.nodes) {
    const sourceNodeTypes = new Set(source.nodes.map((n) => n.type));
    const targetNodeTypes = new Set(target.nodes.map((n) => n.type));

    // 소스에만 있는 노드 타입
    for (const type of sourceNodeTypes) {
      if (!targetNodeTypes.has(type)) {
        differences.push(`소스에만 존재하는 노드 타입: ${type}`);
      }
    }

    // 대상에만 있는 노드 타입
    for (const type of targetNodeTypes) {
      if (!sourceNodeTypes.has(type)) {
        differences.push(`대상에만 존재하는 노드 타입: ${type}`);
      }
    }

    // 같은 이름의 노드 비교
    const sourceNodesByName = new Map(source.nodes.map((n) => [n.name, n]));
    const targetNodesByName = new Map(target.nodes.map((n) => [n.name, n]));

    for (const [name, sourceNode] of sourceNodesByName) {
      const targetNode = targetNodesByName.get(name);

      if (!targetNode) {
        differences.push(`대상에 노드 누락: "${name}"`);
      } else {
        // 노드 타입 비교
        if (sourceNode.type !== targetNode.type) {
          differences.push(`노드 "${name}" 타입 불일치: ${sourceNode.type} vs ${targetNode.type}`);
        }

        // 노드 버전 비교
        if (sourceNode.typeVersion !== targetNode.typeVersion) {
          differences.push(
            `노드 "${name}" 버전 불일치: ${sourceNode.typeVersion} vs ${targetNode.typeVersion}`
          );
        }
      }
    }

    // 대상에만 있는 노드 확인
    for (const name of targetNodesByName.keys()) {
      if (!sourceNodesByName.has(name)) {
        differences.push(`소스에 노드 누락: "${name}"`);
      }
    }
  }

  // 연결 구조 비교 (간단히 키 수로 비교)
  const sourceConnectionCount = Object.keys(source.connections || {}).length;
  const targetConnectionCount = Object.keys(target.connections || {}).length;

  if (sourceConnectionCount !== targetConnectionCount) {
    differences.push(`연결 수 불일치: ${sourceConnectionCount} vs ${targetConnectionCount}`);
  }

  // 활성화 상태 비교
  if (source.active !== target.active) {
    differences.push(`활성화 상태 불일치: ${source.active} vs ${target.active}`);
  }

  return {
    match: differences.length === 0,
    differences,
  };
}
