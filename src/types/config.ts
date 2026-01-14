/**
 * n8n 인스턴스 연결 설정
 * @description n8n API에 연결하기 위한 URL과 인증 정보
 */
export interface N8nInstanceConfig {
  /** n8n API URL (예: http://localhost:5678) */
  url: string;
  /** API Key - 환경변수 참조 가능 (예: ${N8N_API_KEY}) */
  apiKey: string;
}

/**
 * 환경별 설정
 * @description 개발/스테이징/프로덕션 등 환경별 n8n 인스턴스 설정
 */
export interface EnvironmentConfig {
  /** 환경 이름 (dev, staging, prod 등) */
  name: string;
  /** n8n 인스턴스 연결 설정 */
  n8n: N8nInstanceConfig;
  /** 기본 환경 여부 */
  isDefault?: boolean;
  /** 환경 설명 (예: "개발 서버", "운영 서버") */
  description?: string;
  /** 환경 태그 (예: ["local", "test"]) */
  tags?: string[];
}

/**
 * 환경 요약 정보
 * @description 환경 목록 조회 시 사용되는 요약 정보
 */
export interface EnvironmentSummary {
  /** 환경 이름 */
  name: string;
  /** n8n API URL */
  url: string;
  /** 기본 환경 여부 */
  isDefault: boolean;
  /** 환경 설명 */
  description?: string;
  /** 현재 활성 환경 여부 */
  isCurrent: boolean;
}

/**
 * 환경 검증 결과
 * @description 환경 연결 테스트 결과
 */
export interface EnvironmentValidation {
  /** 환경 이름 */
  name: string;
  /** 연결 성공 여부 */
  isValid: boolean;
  /** 오류 메시지 목록 */
  errors: string[];
}

/**
 * Credential 매핑 설정
 * @description 논리적 credential 이름을 환경별 실제 ID로 매핑
 */
export interface CredentialMapping {
  /** 논리적 credential 이름 (예: "slack-bot", "github-token") */
  name: string;
  /** credential 타입 (예: "slackApi", "githubApi") */
  type: string;
  /** 환경별 실제 credential ID 매핑 (예: { dev: "1", staging: "5", prod: "12" }) */
  environments: Record<string, string>;
}

/**
 * Credential 변환 정보
 * @description 두 환경 간 credential ID 변환 맵
 */
export interface CredentialTransform {
  /** 소스 환경 이름 */
  sourceEnv: string;
  /** 대상 환경 이름 */
  targetEnv: string;
  /** 원본 ID와 새 ID 매핑 목록 */
  mappings: {
    /** 원본 환경의 credential ID */
    originalId: string;
    /** 대상 환경의 credential ID */
    newId: string;
    /** 논리적 credential 이름 (참조용) */
    name: string;
    /** credential 타입 (참조용) */
    type: string;
  }[];
}

/**
 * Credential 매핑 요약 정보
 * @description 매핑 목록 조회 시 사용되는 요약 정보
 */
export interface CredentialMappingSummary {
  /** 논리적 credential 이름 */
  name: string;
  /** credential 타입 */
  type: string;
  /** 각 환경별 ID 존재 여부 */
  environmentStatus: Record<string, boolean>;
}

/**
 * 백업 설정
 * @description 워크플로우 백업 관련 설정
 */
export interface BackupConfig {
  /** 백업 파일 저장 기본 디렉토리 (기본값: ./backups) */
  baseDir: string;
  /** 백업 보관 개수 (기본값: 10) */
  retention: number;
  /** credentials 제거 여부 (기본값: true) */
  stripCredentials: boolean;
}

/**
 * 알림 채널 타입
 */
export type AlertChannelType = 'slack' | 'email' | 'webhook';

/**
 * 알림 심각도
 */
export type AlertSeverity = 'info' | 'warning' | 'error' | 'critical';

/**
 * Slack 채널 설정
 */
export interface SlackChannelConfig {
  type: 'slack';
  name?: string;
  webhookUrl: string;
  username?: string;
  iconEmoji?: string;
  channel?: string;
}

/**
 * Email 채널 설정
 */
export interface EmailChannelConfig {
  type: 'email';
  name?: string;
  host: string;
  port: number;
  secure: boolean;
  auth?: {
    user: string;
    pass: string;
  };
  from: string;
  to: string | string[];
}

/**
 * Webhook 채널 설정
 */
export interface WebhookChannelConfig {
  type: 'webhook';
  name?: string;
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH';
  headers?: Record<string, string>;
  authorization?: string;
}

/**
 * 알림 채널 설정 유니온 타입
 */
export type AlertChannelConfig = SlackChannelConfig | EmailChannelConfig | WebhookChannelConfig;

/**
 * 알림 설정
 * @description 알림 시스템 설정
 */
export interface AlertConfig {
  /** 알림 활성화 여부 */
  enabled: boolean;
  /** 채널 설정 목록 */
  channels: AlertChannelConfig[];
}

/**
 * 전체 애플리케이션 설정
 * @description n8n-workflow-manager의 전체 설정 구조
 */
export interface Config {
  /** 설정 파일 버전 */
  version: string;
  /** 현재 활성 환경 이름 */
  currentEnvironment: string;
  /** 환경별 설정 목록 */
  environments: EnvironmentConfig[];
  /** 백업 설정 (선택) */
  backup?: BackupConfig;
  /** Credential 매핑 설정 (선택) - 환경별 credential ID 매핑 */
  credentialMappings?: CredentialMapping[];
  /** 알림 설정 (선택) */
  alerts?: AlertConfig;
}
