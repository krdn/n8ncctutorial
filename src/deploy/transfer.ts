/**
 * 워크플로우 전송 모듈
 * @description 환경 간 워크플로우 직접 전송 (API-to-API)
 */

import type { N8nApiClient } from '../api/client.js';
import type { N8nWorkflow, N8nWorkflowDetail } from '../types/n8n.js';

/**
 * 전송 옵션
 * @description 워크플로우 전송 시 적용할 옵션
 */
export interface TransferOptions {
  /** 전송 모드: create(신규만), update(업데이트만), upsert(둘 다) */
  mode: 'create' | 'update' | 'upsert';
  /** 전송 후 워크플로우 활성화 여부 */
  activateAfterTransfer: boolean;
  /** 원본 ID 유지 시도 여부 */
  preserveId: boolean;
}

/**
 * 전송 결과
 * @description 개별 워크플로우 전송 결과
 */
export interface TransferResult {
  /** 원본 워크플로우 ID */
  workflowId: string;
  /** 워크플로우 이름 */
  workflowName: string;
  /** 대상 환경의 워크플로우 ID */
  targetId: string;
  /** 수행된 작업 유형 */
  action: 'created' | 'updated' | 'skipped';
  /** 성공 여부 */
  success: boolean;
  /** 에러 메시지 (실패 시) */
  error?: string;
}

/**
 * 기본 전송 옵션
 */
export const DEFAULT_TRANSFER_OPTIONS: TransferOptions = {
  mode: 'upsert',
  activateAfterTransfer: false,
  preserveId: false,
};

/**
 * 워크플로우 전송 준비
 * @description 불필요한 메타데이터 제거 및 ID 처리
 * @param workflow - 원본 워크플로우
 * @param preserveId - ID 유지 여부
 * @returns 전송 준비된 워크플로우
 */
export function prepareWorkflowForTransfer(
  workflow: N8nWorkflowDetail,
  preserveId = false
): Partial<N8nWorkflowDetail> {
  // 불필요한 메타데이터 제거
  const {
    id,
    createdAt,
    updatedAt,
    staticData,
    pinData,
    ...transferData
  } = workflow;

  // ID 유지 옵션에 따라 ID 포함
  if (preserveId) {
    return {
      ...transferData,
      id,
    };
  }

  return transferData;
}

/**
 * 대상 환경에서 이름으로 워크플로우 검색
 * @param client - 대상 환경 API 클라이언트
 * @param name - 워크플로우 이름
 * @returns 찾은 워크플로우 또는 null
 */
export async function findWorkflowByNameInTarget(
  client: N8nApiClient,
  name: string
): Promise<N8nWorkflow | null> {
  const workflows = await client.getAllWorkflows();
  return workflows.find((w) => w.name === name) ?? null;
}

/**
 * 단일 워크플로우 전송
 * @description 소스 환경에서 대상 환경으로 워크플로우 전송
 * @param sourceClient - 소스 환경 API 클라이언트
 * @param targetClient - 대상 환경 API 클라이언트
 * @param workflowId - 전송할 워크플로우 ID
 * @param options - 전송 옵션
 * @returns 전송 결과
 */
export async function transferWorkflow(
  sourceClient: N8nApiClient,
  targetClient: N8nApiClient,
  workflowId: string,
  options: Partial<TransferOptions> = {}
): Promise<TransferResult> {
  const opts: TransferOptions = { ...DEFAULT_TRANSFER_OPTIONS, ...options };

  try {
    // 소스에서 워크플로우 조회
    const workflow = await sourceClient.getWorkflow(workflowId);

    // 전송 준비 (메타데이터 제거)
    const transferData = prepareWorkflowForTransfer(workflow, opts.preserveId);

    // 대상 환경에서 동일 이름 워크플로우 검색
    const existing = await findWorkflowByNameInTarget(targetClient, workflow.name);

    let action: 'created' | 'updated' | 'skipped';
    let targetId: string;

    if (existing) {
      // 기존 워크플로우 존재
      if (opts.mode === 'create') {
        // create 모드: 기존 워크플로우 있으면 건너뛰기
        return {
          workflowId: workflow.id,
          workflowName: workflow.name,
          targetId: existing.id,
          action: 'skipped',
          success: true,
        };
      }

      // update 또는 upsert 모드: 업데이트 수행
      const result = await targetClient.updateWorkflow(existing.id, transferData);
      targetId = result.id;
      action = 'updated';
    } else {
      // 기존 워크플로우 없음
      if (opts.mode === 'update') {
        // update 모드: 기존 워크플로우 없으면 건너뛰기
        return {
          workflowId: workflow.id,
          workflowName: workflow.name,
          targetId: '',
          action: 'skipped',
          success: true,
        };
      }

      // create 또는 upsert 모드: 신규 생성
      const result = await targetClient.createWorkflow(transferData);
      targetId = result.id;
      action = 'created';
    }

    // 활성화 옵션 처리
    if (opts.activateAfterTransfer) {
      await targetClient.activateWorkflow(targetId);
    }

    return {
      workflowId: workflow.id,
      workflowName: workflow.name,
      targetId,
      action,
      success: true,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    // 워크플로우 정보를 가져오지 못한 경우 기본값 사용
    return {
      workflowId,
      workflowName: '',
      targetId: '',
      action: 'skipped',
      success: false,
      error: message,
    };
  }
}

/**
 * 다중 워크플로우 전송
 * @description 지정된 워크플로우들을 순차적으로 전송
 * @param sourceClient - 소스 환경 API 클라이언트
 * @param targetClient - 대상 환경 API 클라이언트
 * @param workflowIds - 전송할 워크플로우 ID 목록
 * @param options - 전송 옵션
 * @returns 전송 결과 배열
 */
export async function transferWorkflows(
  sourceClient: N8nApiClient,
  targetClient: N8nApiClient,
  workflowIds: string[],
  options: Partial<TransferOptions> = {}
): Promise<TransferResult[]> {
  const results: TransferResult[] = [];

  for (const workflowId of workflowIds) {
    const result = await transferWorkflow(
      sourceClient,
      targetClient,
      workflowId,
      options
    );
    results.push(result);
  }

  return results;
}

/**
 * 전체 워크플로우 전송
 * @description 소스 환경의 모든 워크플로우를 대상 환경으로 전송
 * @param sourceClient - 소스 환경 API 클라이언트
 * @param targetClient - 대상 환경 API 클라이언트
 * @param options - 전송 옵션
 * @returns 전송 결과 배열
 */
export async function transferAllWorkflows(
  sourceClient: N8nApiClient,
  targetClient: N8nApiClient,
  options: Partial<TransferOptions> = {}
): Promise<TransferResult[]> {
  // 소스 환경에서 모든 워크플로우 조회
  const workflows = await sourceClient.getAllWorkflows();
  const workflowIds = workflows.map((w) => w.id);

  return transferWorkflows(sourceClient, targetClient, workflowIds, options);
}
