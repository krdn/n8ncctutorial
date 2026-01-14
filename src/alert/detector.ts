/**
 * 오류 감지 모듈
 * @description 워크플로우 실행 오류를 감지하는 함수들
 */

import type { N8nApiClient } from '../api/index.js';
import type { N8nExecution } from '../types/n8n.js';
import { getExecutions } from '../monitor/executions.js';

/**
 * 오류 감지 옵션
 */
export interface DetectionOptions {
  /** 조회 시작 시점 (기본: 1시간 전) */
  since?: Date;
  /** 특정 워크플로우만 조회 */
  workflowIds?: string[];
  /** 최대 조회 개수 */
  limit?: number;
}

/**
 * 오류 감지 결과
 */
export interface DetectionResult {
  /** 오류 존재 여부 */
  hasErrors: boolean;
  /** 오류가 발생한 실행 목록 */
  executions: N8nExecution[];
  /** 감지 시점 */
  detectedAt: Date;
}

/**
 * 오류 상세 정보
 */
export interface ErrorDetails {
  /** 워크플로우 ID */
  workflowId: string;
  /** 워크플로우 이름 (가능한 경우) */
  workflowName?: string;
  /** 실행 ID */
  executionId: string;
  /** 에러 메시지 (가능한 경우) */
  errorMessage?: string;
  /** 실행 시작 시간 */
  startedAt: Date;
  /** 실행 종료 시간 (가능한 경우) */
  stoppedAt?: Date;
}

/**
 * 오류 발생 실행 감지
 * @param client - n8n API 클라이언트
 * @param options - 감지 옵션
 * @returns 감지 결과
 */
export async function detectErrors(
  client: N8nApiClient,
  options?: DetectionOptions
): Promise<DetectionResult> {
  // 기본값: 1시간 전부터
  const since = options?.since ?? new Date(Date.now() - 60 * 60 * 1000);
  const limit = options?.limit ?? 100;

  // 워크플로우 ID가 지정된 경우 각각 조회
  let allExecutions: N8nExecution[] = [];

  if (options?.workflowIds && options.workflowIds.length > 0) {
    for (const workflowId of options.workflowIds) {
      const executions = await getExecutions(client, {
        workflowId,
        status: 'error',
        startedAfter: since,
        limit,
      });
      allExecutions.push(...executions);
    }
  } else {
    // 전체 실행에서 에러만 필터링
    allExecutions = await getExecutions(client, {
      status: 'error',
      startedAfter: since,
      limit,
    });
  }

  return {
    hasErrors: allExecutions.length > 0,
    executions: allExecutions,
    detectedAt: new Date(),
  };
}

/**
 * 새로운 오류 감지 (마지막 체크 이후)
 * @param client - n8n API 클라이언트
 * @param lastChecked - 마지막 체크 시점
 * @returns 감지 결과
 */
export async function detectNewErrors(
  client: N8nApiClient,
  lastChecked: Date
): Promise<DetectionResult> {
  return detectErrors(client, {
    since: lastChecked,
  });
}

/**
 * 실행 객체에서 오류 상세 정보 추출
 * @param execution - 실행 객체
 * @returns 오류 상세 정보
 */
export function getErrorDetails(execution: N8nExecution): ErrorDetails {
  // resultData에서 에러 메시지 추출 시도
  let errorMessage: string | undefined;

  if (execution.data?.resultData) {
    const resultData = execution.data.resultData as Record<string, unknown>;
    // n8n의 에러 구조에서 메시지 추출 시도
    if (typeof resultData.error === 'object' && resultData.error !== null) {
      const error = resultData.error as Record<string, unknown>;
      errorMessage = typeof error.message === 'string' ? error.message : undefined;
    }
  }

  return {
    workflowId: execution.workflowId,
    executionId: execution.id,
    errorMessage,
    startedAt: new Date(execution.startedAt),
    stoppedAt: execution.stoppedAt ? new Date(execution.stoppedAt) : undefined,
  };
}
