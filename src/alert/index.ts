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

// 오류 감지 함수 export
export type { DetectionOptions, DetectionResult, ErrorDetails } from './detector.js';
export { detectErrors, detectNewErrors, getErrorDetails } from './detector.js';

// 알림 트리거 함수 export
export type { TriggerResult, TriggerOptions } from './trigger.js';
export {
  createErrorAlertMessage,
  triggerAlertForExecution,
  triggerAlertsForErrors,
  createSummaryAlertMessage,
} from './trigger.js';

// 알림 규칙 export
export type {
  AlertRuleConditionType,
  AlertRuleOperator,
  AlertRuleCondition,
  AlertRule,
  AlertRulesConfig,
} from './types.js';

export type { RuleContext } from './rules.js';
export {
  loadRules,
  saveRules,
  evaluateRule,
  findMatchingRules,
  createDefaultRules,
  DEFAULT_RULES_PATH,
} from './rules.js';

// Watcher export
export type { WatcherState, WatchResult, AlertWatcher } from './watcher.js';
export { createWatcher } from './watcher.js';
