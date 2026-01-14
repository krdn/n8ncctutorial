/**
 * 실행 조회 모듈
 * @description 워크플로우 실행 상태 조회 및 통계 계산 함수
 */

import type { N8nApiClient } from '../api/index.js';
import type { N8nExecution, N8nExecutionStatus } from '../types/n8n.js';
import type {
  ExecutionFilter,
  ExecutionSummary,
  MonitoringResult,
  WorkflowExecutionStats,
} from './types.js';

/**
 * 실행 목록 조회 (필터링 지원)
 * @description N8nApiClient.getExecutions()를 래핑하여 필터링 기능 제공
 * @param client - n8n API 클라이언트
 * @param filter - 필터 옵션 (선택)
 * @returns 필터링된 실행 목록
 */
export async function getExecutions(
  client: N8nApiClient,
  filter?: ExecutionFilter
): Promise<N8nExecution[]> {
  // API에서 실행 목록 조회 (workflowId 필터는 API 레벨에서 적용)
  const apiLimit = filter?.limit ? Math.min(filter.limit * 2, 250) : 100;
  const executions = await client.getExecutions(filter?.workflowId, apiLimit);

  // 추가 필터링 적용
  let filtered = executions;

  // 상태 필터링
  if (filter?.status !== undefined) {
    const statusArray = Array.isArray(filter.status)
      ? filter.status
      : [filter.status];
    filtered = filtered.filter((exec) => statusArray.includes(exec.status));
  }

  // 시작 시간 필터링 (startedAfter)
  if (filter?.startedAfter) {
    const afterTime = filter.startedAfter.getTime();
    filtered = filtered.filter((exec) => {
      const startedAt = new Date(exec.startedAt).getTime();
      return startedAt >= afterTime;
    });
  }

  // 시작 시간 필터링 (startedBefore)
  if (filter?.startedBefore) {
    const beforeTime = filter.startedBefore.getTime();
    filtered = filtered.filter((exec) => {
      const startedAt = new Date(exec.startedAt).getTime();
      return startedAt <= beforeTime;
    });
  }

  // limit 적용
  if (filter?.limit && filtered.length > filter.limit) {
    filtered = filtered.slice(0, filter.limit);
  }

  return filtered;
}

/**
 * 실행 요약 통계 계산
 * @description 실행 배열에서 상태별 집계 계산
 * @param executions - 실행 배열
 * @returns 실행 요약 통계
 */
export function getExecutionsSummary(executions: N8nExecution[]): ExecutionSummary {
  const summary: ExecutionSummary = {
    total: executions.length,
    success: 0,
    error: 0,
    running: 0,
    waiting: 0,
  };

  for (const exec of executions) {
    switch (exec.status) {
      case 'success':
        summary.success++;
        break;
      case 'error':
        summary.error++;
        break;
      case 'running':
        summary.running++;
        break;
      case 'waiting':
        summary.waiting++;
        break;
      // 'canceled', 'unknown' 등 다른 상태는 total에만 포함
    }
  }

  return summary;
}

/**
 * 모니터링 데이터 조회
 * @description 실행 목록과 요약 통계를 함께 반환
 * @param client - n8n API 클라이언트
 * @param filter - 필터 옵션 (선택)
 * @returns 모니터링 결과 (실행 목록 + 요약 + 조회 시점)
 */
export async function fetchMonitoringData(
  client: N8nApiClient,
  filter?: ExecutionFilter
): Promise<MonitoringResult> {
  const executions = await getExecutions(client, filter);
  const summary = getExecutionsSummary(executions);

  return {
    executions,
    summary,
    fetchedAt: new Date(),
  };
}

/**
 * 워크플로우별 실행 통계 조회
 * @description 특정 워크플로우의 실행 통계 계산
 * @param client - n8n API 클라이언트
 * @param workflowId - 워크플로우 ID
 * @param limit - 조회할 실행 개수 (기본 100)
 * @returns 워크플로우 실행 통계
 */
export async function getWorkflowStats(
  client: N8nApiClient,
  workflowId: string,
  limit = 100
): Promise<WorkflowExecutionStats> {
  // 워크플로우 정보 조회
  const workflow = await client.getWorkflow(workflowId);

  // 실행 목록 조회
  const executions = await client.getExecutions(workflowId, limit);

  // 기본 통계 초기화
  const stats: WorkflowExecutionStats = {
    workflowId,
    workflowName: workflow.name,
    totalExecutions: executions.length,
    successRate: 0,
  };

  if (executions.length === 0) {
    return stats;
  }

  // 성공률 계산
  const successCount = executions.filter((e) => e.status === 'success').length;
  stats.successRate = Math.round((successCount / executions.length) * 100);

  // 평균 실행 시간 계산 (완료된 실행만)
  const completedExecutions = executions.filter(
    (e) => e.finished && e.startedAt && e.stoppedAt
  );

  if (completedExecutions.length > 0) {
    const totalDuration = completedExecutions.reduce((sum, exec) => {
      const startTime = new Date(exec.startedAt).getTime();
      const stopTime = new Date(exec.stoppedAt!).getTime();
      return sum + (stopTime - startTime);
    }, 0);
    stats.avgDuration = Math.round(totalDuration / completedExecutions.length);
  }

  // 마지막 실행 정보 (첫 번째 요소가 가장 최근)
  const lastExecution = executions[0];
  if (lastExecution) {
    stats.lastExecution = new Date(lastExecution.startedAt);
    stats.lastStatus = lastExecution.status;
  }

  return stats;
}
