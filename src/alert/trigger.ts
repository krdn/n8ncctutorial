/**
 * 알림 트리거 모듈
 * @description 감지된 오류에 대한 알림 자동 트리거
 */

import type { N8nExecution } from '../types/n8n.js';
import type {
  AlertChannelConfig,
  AlertMessage,
  AlertResult,
  AlertSeverity,
} from './types.js';
import type { DetectionResult } from './detector.js';
import { getErrorDetails } from './detector.js';
import { sendAlerts, summarizeResults } from './send.js';

/**
 * 트리거 결과
 */
export interface TriggerResult {
  /** 트리거 발생 여부 */
  triggered: boolean;
  /** 전송된 알림 수 */
  alertsSent: number;
  /** 개별 전송 결과 */
  results: AlertResult[];
}

/**
 * 트리거 옵션
 */
export interface TriggerOptions {
  /** 한 번에 전송할 최대 알림 수 (기본: 10) */
  maxAlerts?: number;
}

/**
 * 실행 정보에서 AlertMessage 생성
 * @param execution - 실행 객체
 * @param severity - 심각도 (기본: error)
 * @returns AlertMessage
 */
export function createErrorAlertMessage(
  execution: N8nExecution,
  severity: AlertSeverity = 'error'
): AlertMessage {
  const details = getErrorDetails(execution);

  const messageParts = [
    `워크플로우 실행 중 오류가 발생했습니다.`,
    ``,
    `실행 ID: ${details.executionId}`,
    `워크플로우 ID: ${details.workflowId}`,
    `시작 시간: ${details.startedAt.toISOString()}`,
  ];

  if (details.stoppedAt) {
    messageParts.push(`종료 시간: ${details.stoppedAt.toISOString()}`);
  }

  if (details.errorMessage) {
    messageParts.push(``, `에러 메시지: ${details.errorMessage}`);
  }

  return {
    title: '워크플로우 실행 오류',
    message: messageParts.join('\n'),
    severity,
    workflowId: details.workflowId,
    workflowName: details.workflowName,
    executionId: details.executionId,
    timestamp: new Date(),
    metadata: {
      startedAt: details.startedAt.toISOString(),
      stoppedAt: details.stoppedAt?.toISOString(),
      errorMessage: details.errorMessage,
    },
  };
}

/**
 * 단일 실행에 대한 알림 전송
 * @param execution - 실행 객체
 * @param channels - 알림 채널 목록
 * @param severity - 심각도
 * @returns 트리거 결과
 */
export async function triggerAlertForExecution(
  execution: N8nExecution,
  channels: AlertChannelConfig[],
  severity: AlertSeverity = 'error'
): Promise<TriggerResult> {
  if (channels.length === 0) {
    return {
      triggered: false,
      alertsSent: 0,
      results: [],
    };
  }

  const message = createErrorAlertMessage(execution, severity);
  const results = await sendAlerts(message, channels);
  const summary = summarizeResults(results);

  return {
    triggered: true,
    alertsSent: summary.success,
    results,
  };
}

/**
 * 감지된 오류들에 대해 알림 전송
 * @param detectionResult - 오류 감지 결과
 * @param channels - 알림 채널 목록
 * @param options - 트리거 옵션
 * @returns 트리거 결과
 */
export async function triggerAlertsForErrors(
  detectionResult: DetectionResult,
  channels: AlertChannelConfig[],
  options?: TriggerOptions
): Promise<TriggerResult> {
  if (!detectionResult.hasErrors || channels.length === 0) {
    return {
      triggered: false,
      alertsSent: 0,
      results: [],
    };
  }

  const maxAlerts = options?.maxAlerts ?? 10;
  const executions = detectionResult.executions.slice(0, maxAlerts);

  const allResults: AlertResult[] = [];
  let totalSent = 0;

  for (const execution of executions) {
    const result = await triggerAlertForExecution(execution, channels);
    allResults.push(...result.results);
    totalSent += result.alertsSent;
  }

  return {
    triggered: true,
    alertsSent: totalSent,
    results: allResults,
  };
}

/**
 * 요약 알림 메시지 생성
 * @param detectionResult - 오류 감지 결과
 * @returns AlertMessage
 */
export function createSummaryAlertMessage(
  detectionResult: DetectionResult
): AlertMessage {
  const errorCount = detectionResult.executions.length;
  const workflowIds = [...new Set(detectionResult.executions.map((e) => e.workflowId))];

  const messageParts = [
    `${errorCount}건의 워크플로우 실행 오류가 감지되었습니다.`,
    ``,
    `영향받은 워크플로우: ${workflowIds.length}개`,
    `워크플로우 ID: ${workflowIds.slice(0, 5).join(', ')}${workflowIds.length > 5 ? ' 외 ' + (workflowIds.length - 5) + '개' : ''}`,
    ``,
    `감지 시점: ${detectionResult.detectedAt.toISOString()}`,
  ];

  return {
    title: `워크플로우 오류 요약 (${errorCount}건)`,
    message: messageParts.join('\n'),
    severity: errorCount >= 5 ? 'critical' : 'error',
    timestamp: new Date(),
    metadata: {
      errorCount,
      workflowIds,
      detectedAt: detectionResult.detectedAt.toISOString(),
    },
  };
}
