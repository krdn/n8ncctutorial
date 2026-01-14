/**
 * Webhook 알림 채널 구현
 * @description 일반 HTTP Webhook을 통한 알림 전송
 */

import type { AlertMessage, AlertResult, WebhookChannelConfig } from '../types.js';

/**
 * AlertMessage를 Webhook 페이로드로 변환
 * @param message - 알림 메시지
 * @returns Webhook 페이로드
 */
function buildWebhookPayload(message: AlertMessage): Record<string, unknown> {
  return {
    title: message.title,
    message: message.message,
    severity: message.severity,
    timestamp: message.timestamp.toISOString(),
    workflowId: message.workflowId,
    workflowName: message.workflowName,
    executionId: message.executionId,
    metadata: message.metadata,
    source: 'n8n-workflow-manager',
  };
}

/**
 * Webhook으로 알림 전송
 * @param message - 알림 메시지
 * @param config - Webhook 채널 설정
 * @returns 전송 결과
 */
export async function sendWebhookAlert(
  message: AlertMessage,
  config: WebhookChannelConfig
): Promise<AlertResult> {
  try {
    const payload = buildWebhookPayload(message);
    const method = config.method ?? 'POST';

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...config.headers,
    };

    if (config.authorization) {
      headers['Authorization'] = config.authorization;
    }

    const response = await fetch(config.url, {
      method,
      headers,
      body: method !== 'GET' ? JSON.stringify(payload) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        channel: 'webhook',
        channelName: config.name,
        error: `Webhook 오류: ${response.status} - ${errorText}`,
      };
    }

    // 응답 본문 파싱 시도
    let responseData: unknown;
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      try {
        responseData = await response.json();
      } catch {
        responseData = await response.text();
      }
    } else {
      responseData = await response.text();
    }

    return {
      success: true,
      channel: 'webhook',
      channelName: config.name,
      response: responseData,
    };
  } catch (error) {
    return {
      success: false,
      channel: 'webhook',
      channelName: config.name,
      error: error instanceof Error ? error.message : '알 수 없는 오류',
    };
  }
}
