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
}

/**
 * 백업 설정
 * @description 워크플로우 백업 관련 설정
 */
export interface BackupConfig {
  /** 백업 파일 저장 디렉토리 */
  directory: string;
  /** 백업 보관 기간 (일 단위) */
  retention: number;
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
}
