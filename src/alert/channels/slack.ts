/**
 * Slack 알림 채널 구현
 * @description Slack Webhook을 통한 알림 전송
 */

import type { AlertMessage, AlertResult, SlackChannelConfig } from '../types.js';

/**
 * Slack 메시지 색상 결정
 * @param severity - 알림 심각도
 * @returns Slack attachment 색상
 */
function getSeverityColor(severity: AlertMessage['severity']): string {
  switch (severity) {
    case 'critical':
      return '#FF0000'; // 빨강
    case 'error':
      return '#DC3545'; // 진한 빨강
    case 'warning':
      return '#FFC107'; // 노랑
    case 'info':
    default:
      return '#17A2B8'; // 파랑
  }
}

/**
 * Slack 이모지 결정
 * @param severity - 알림 심각도
 * @returns 이모지 문자열
 */
function getSeverityEmoji(severity: AlertMessage['severity']): string {
  switch (severity) {
    case 'critical':
      return ':rotating_light:';
    case 'error':
      return ':x:';
    case 'warning':
      return ':warning:';
    case 'info':
    default:
      return ':information_source:';
  }
}

/**
 * AlertMessage를 Slack 페이로드로 변환
 * @param message - 알림 메시지
 * @param config - Slack 채널 설정
 * @returns Slack webhook 페이로드
 */
function buildSlackPayload(
  message: AlertMessage,
  config: SlackChannelConfig
): Record<string, unknown> {
  const emoji = getSeverityEmoji(message.severity);
  const color = getSeverityColor(message.severity);

  const fields: { title: string; value: string; short: boolean }[] = [];

  if (message.workflowId) {
    fields.push({
      title: 'Workflow ID',
      value: message.workflowId,
      short: true,
    });
  }

  if (message.workflowName) {
    fields.push({
      title: 'Workflow Name',
      value: message.workflowName,
      short: true,
    });
  }

  if (message.executionId) {
    fields.push({
      title: 'Execution ID',
      value: message.executionId,
      short: true,
    });
  }

  fields.push({
    title: 'Severity',
    value: message.severity.toUpperCase(),
    short: true,
  });

  fields.push({
    title: 'Time',
    value: message.timestamp.toISOString(),
    short: true,
  });

  return {
    username: config.username ?? 'n8n-wfm',
    icon_emoji: config.iconEmoji ?? emoji,
    channel: config.channel,
    attachments: [
      {
        color,
        title: `${emoji} ${message.title}`,
        text: message.message,
        fields,
        footer: 'n8n Workflow Manager',
        ts: Math.floor(message.timestamp.getTime() / 1000),
      },
    ],
  };
}

/**
 * Slack으로 알림 전송
 * @param message - 알림 메시지
 * @param config - Slack 채널 설정
 * @returns 전송 결과
 */
export async function sendSlackAlert(
  message: AlertMessage,
  config: SlackChannelConfig
): Promise<AlertResult> {
  try {
    const payload = buildSlackPayload(message, config);

    const response = await fetch(config.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        channel: 'slack',
        channelName: config.name,
        error: `Slack API 오류: ${response.status} - ${errorText}`,
      };
    }

    return {
      success: true,
      channel: 'slack',
      channelName: config.name,
      response: await response.text(),
    };
  } catch (error) {
    return {
      success: false,
      channel: 'slack',
      channelName: config.name,
      error: error instanceof Error ? error.message : '알 수 없는 오류',
    };
  }
}
