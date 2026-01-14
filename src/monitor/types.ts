/**
 * 모니터링 모듈 타입 정의
 * @description 워크플로우 실행 상태 모니터링을 위한 타입 정의
 */

import type { N8nExecution, N8nExecutionStatus } from '../types/n8n.js';

/**
 * 실행 필터 옵션
 * @description 실행 목록 조회 시 사용되는 필터 조건
 */
export interface ExecutionFilter {
  /** 특정 워크플로우 ID */
  workflowId?: string;
  /** 실행 상태 필터 (단일 또는 다중) */
  status?: N8nExecutionStatus | N8nExecutionStatus[];
  /** 이 시간 이후에 시작된 실행만 */
  startedAfter?: Date;
  /** 이 시간 이전에 시작된 실행만 */
  startedBefore?: Date;
  /** 최대 조회 개수 */
  limit?: number;
}

/**
 * 실행 요약 통계
 * @description 실행 목록의 상태별 집계 정보
 */
export interface ExecutionSummary {
  /** 전체 실행 수 */
  total: number;
  /** 성공 실행 수 */
  success: number;
  /** 에러 실행 수 */
  error: number;
  /** 실행 중 개수 */
  running: number;
  /** 대기 중 개수 */
  waiting: number;
}

/**
 * 워크플로우별 실행 통계
 * @description 특정 워크플로우의 실행 통계 정보
 */
export interface WorkflowExecutionStats {
  /** 워크플로우 ID */
  workflowId: string;
  /** 워크플로우 이름 */
  workflowName: string;
  /** 전체 실행 수 */
  totalExecutions: number;
  /** 성공률 (0-100) */
  successRate: number;
  /** 평균 실행 시간 (ms) */
  avgDuration?: number;
  /** 마지막 실행 시간 */
  lastExecution?: Date;
  /** 마지막 실행 상태 */
  lastStatus?: N8nExecutionStatus;
}

/**
 * 모니터링 결과
 * @description fetchMonitoringData 함수의 반환 타입
 */
export interface MonitoringResult {
  /** 실행 목록 */
  executions: N8nExecution[];
  /** 요약 통계 */
  summary: ExecutionSummary;
  /** 데이터 조회 시점 */
  fetchedAt: Date;
}
