/**
 * 알림 모듈 타입 정의
 * @description 워크플로우 오류 알림을 위한 타입 정의
 */

/**
 * 알림 채널 타입
 */
export type AlertChannelType = 'slack' | 'email' | 'webhook';

/**
 * 알림 심각도
 */
export type AlertSeverity = 'info' | 'warning' | 'error' | 'critical';

/**
 * 알림 메시지 인터페이스
 * @description 모든 알림 채널에 공통으로 사용되는 메시지 구조
 */
export interface AlertMessage {
  /** 알림 제목 */
  title: string;
  /** 알림 본문 */
  message: string;
  /** 심각도 */
  severity: AlertSeverity;
  /** 관련 워크플로우 ID (선택) */
  workflowId?: string;
  /** 관련 워크플로우 이름 (선택) */
  workflowName?: string;
  /** 관련 실행 ID (선택) */
  executionId?: string;
  /** 알림 생성 시간 */
  timestamp: Date;
  /** 추가 메타데이터 (선택) */
  metadata?: Record<string, unknown>;
}

/**
 * 알림 전송 결과
 */
export interface AlertResult {
  /** 전송 성공 여부 */
  success: boolean;
  /** 채널 타입 */
  channel: AlertChannelType;
  /** 채널 이름 (선택) */
  channelName?: string;
  /** 에러 메시지 (실패 시) */
  error?: string;
  /** 응답 데이터 (선택) */
  response?: unknown;
}

/**
 * Slack 채널 설정
 */
export interface SlackChannelConfig {
  /** 채널 타입 */
  type: 'slack';
  /** 채널 이름 (식별용) */
  name?: string;
  /** Slack Webhook URL */
  webhookUrl: string;
  /** 메시지에 표시될 사용자 이름 (선택) */
  username?: string;
  /** 아이콘 이모지 (선택, 예: ":warning:") */
  iconEmoji?: string;
  /** 기본 채널 (선택, webhook에 설정 안된 경우) */
  channel?: string;
}

/**
 * Email 채널 설정
 */
export interface EmailChannelConfig {
  /** 채널 타입 */
  type: 'email';
  /** 채널 이름 (식별용) */
  name?: string;
  /** SMTP 호스트 */
  host: string;
  /** SMTP 포트 */
  port: number;
  /** TLS/SSL 사용 여부 */
  secure: boolean;
  /** 인증 정보 (선택) */
  auth?: {
    user: string;
    pass: string;
  };
  /** 발신자 이메일 주소 */
  from: string;
  /** 수신자 이메일 주소 (단일 또는 배열) */
  to: string | string[];
}

/**
 * Webhook 채널 설정
 */
export interface WebhookChannelConfig {
  /** 채널 타입 */
  type: 'webhook';
  /** 채널 이름 (식별용) */
  name?: string;
  /** Webhook URL */
  url: string;
  /** HTTP 메서드 (기본: POST) */
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH';
  /** 커스텀 헤더 (선택) */
  headers?: Record<string, string>;
  /** 인증 헤더 (선택, Authorization 헤더 값) */
  authorization?: string;
}

/**
 * 알림 채널 설정 유니온 타입
 */
export type AlertChannelConfig = SlackChannelConfig | EmailChannelConfig | WebhookChannelConfig;

/**
 * 알림 설정
 * @description 전체 알림 시스템 설정
 */
export interface AlertConfig {
  /** 알림 활성화 여부 */
  enabled: boolean;
  /** 채널 설정 목록 */
  channels: AlertChannelConfig[];
}

/**
 * 알림 규칙 조건 타입
 */
export type AlertRuleConditionType = 'error' | 'success_rate' | 'duration';

/**
 * 알림 규칙 조건 연산자
 */
export type AlertRuleOperator = 'lt' | 'gt' | 'eq';

/**
 * 알림 규칙 조건
 * @description 알림이 트리거되는 조건 정의
 */
export interface AlertRuleCondition {
  /** 조건 타입 (error: 에러 발생, success_rate: 성공률, duration: 실행 시간) */
  type: AlertRuleConditionType;
  /** 임계값 (success_rate: 백분율, duration: 밀리초) */
  threshold?: number;
  /** 비교 연산자 (lt: 미만, gt: 초과, eq: 같음) */
  operator?: AlertRuleOperator;
}

/**
 * 알림 규칙
 * @description 알림 발생 조건과 대상을 정의하는 규칙
 */
export interface AlertRule {
  /** 규칙 고유 ID */
  id: string;
  /** 규칙 이름 */
  name: string;
  /** 규칙 활성화 여부 */
  enabled: boolean;
  /** 알림 조건 */
  condition: AlertRuleCondition;
  /** 대상 워크플로우 ID 목록 (없으면 전체) */
  workflowIds?: string[];
  /** 알림 채널 이름 목록 */
  channels: string[];
  /** 알림 심각도 */
  severity: AlertSeverity;
  /** 중복 알림 방지 쿨다운 (초) */
  cooldown?: number;
}

/**
 * 알림 규칙 설정
 * @description 규칙 파일 구조
 */
export interface AlertRulesConfig {
  /** 규칙 목록 */
  rules: AlertRule[];
}
