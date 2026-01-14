/**
 * 알림 모듈 진입점
 * @description 알림 관련 모든 함수와 타입을 export
 */

// 타입 export
export type {
  AlertChannelType,
  AlertSeverity,
  AlertMessage,
  AlertResult,
  SlackChannelConfig,
  EmailChannelConfig,
  WebhookChannelConfig,
  AlertChannelConfig,
  AlertConfig,
} from './types.js';

// 채널별 전송 함수 export
export { sendSlackAlert } from './channels/slack.js';
export { sendWebhookAlert } from './channels/webhook.js';
export { sendEmailAlert } from './channels/email.js';

// 통합 전송 함수 export
export {
  sendAlert,
  sendAlerts,
  summarizeResults,
  createAlertMessage,
} from './send.js';
