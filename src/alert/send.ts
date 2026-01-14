/**
 * 알림 전송 통합 모듈
 * @description 모든 채널을 통한 알림 전송 관리
 */

import type { AlertChannelConfig, AlertMessage, AlertResult } from './types.js';
import { sendSlackAlert } from './channels/slack.js';
import { sendWebhookAlert } from './channels/webhook.js';
import { sendEmailAlert } from './channels/email.js';

/**
 * 단일 채널로 알림 전송
 * @param message - 알림 메시지
 * @param channel - 채널 설정
 * @returns 전송 결과
 */
export async function sendAlert(
  message: AlertMessage,
  channel: AlertChannelConfig
): Promise<AlertResult> {
  switch (channel.type) {
    case 'slack':
      return sendSlackAlert(message, channel);
    case 'webhook':
      return sendWebhookAlert(message, channel);
    case 'email':
      return sendEmailAlert(message, channel);
    default:
      return {
        success: false,
        channel: (channel as { type: string }).type as AlertResult['channel'],
        error: `지원하지 않는 채널 타입: ${(channel as { type: string }).type}`,
      };
  }
}

/**
 * 여러 채널로 알림 전송
 * @param message - 알림 메시지
 * @param channels - 채널 설정 배열
 * @returns 전송 결과 배열
 */
export async function sendAlerts(
  message: AlertMessage,
  channels: AlertChannelConfig[]
): Promise<AlertResult[]> {
  const results = await Promise.all(
    channels.map((channel) => sendAlert(message, channel))
  );
  return results;
}

/**
 * 알림 전송 결과 요약
 * @param results - 전송 결과 배열
 * @returns 요약 정보
 */
export function summarizeResults(results: AlertResult[]): {
  total: number;
  success: number;
  failed: number;
  errors: string[];
} {
  const success = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;
  const errors = results
    .filter((r) => !r.success && r.error)
    .map((r) => `[${r.channel}${r.channelName ? `:${r.channelName}` : ''}] ${r.error}`);

  return {
    total: results.length,
    success,
    failed,
    errors,
  };
}

/**
 * AlertMessage 생성 헬퍼
 * @param partial - 부분 메시지 정보
 * @returns 완전한 AlertMessage
 */
export function createAlertMessage(
  partial: Omit<AlertMessage, 'timestamp'> & { timestamp?: Date }
): AlertMessage {
  return {
    ...partial,
    timestamp: partial.timestamp ?? new Date(),
  };
}
