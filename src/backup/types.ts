/**
 * 백업 모듈 타입 정의
 * @description 백업 관련 TypeScript 타입 및 인터페이스 정의
 */

/**
 * 백업 메타데이터
 * @description 백업 세션의 기본 정보
 */
export interface BackupMetadata {
  /** 백업 고유 ID (타임스탬프 기반: YYYYMMDD_HHmmss) */
  id: string;
  /** 백업 생성 시각 (ISO 8601 형식) */
  timestamp: string;
  /** 백업 대상 환경 이름 */
  environment: string;
  /** n8n 인스턴스 URL */
  n8nUrl: string;
  /** 백업된 워크플로우 총 개수 */
  workflowCount: number;
  /** 백업 생성자 정보 (선택) */
  createdBy?: string;
  /** 백업 설명 메모 (선택) */
  description?: string;
}

/**
 * 백업 워크플로우 정보
 * @description 매니페스트에 포함되는 각 워크플로우의 요약 정보
 */
export interface BackupWorkflowInfo {
  /** 워크플로우 ID */
  id: string;
  /** 워크플로우 이름 */
  name: string;
  /** 활성화 상태 */
  active: boolean;
  /** 저장된 파일명 */
  filename: string;
  /** 원본 수정 시각 */
  updatedAt: string;
}

/**
 * 백업 매니페스트
 * @description 백업 세션의 전체 정보를 담는 manifest.json 파일 구조
 */
export interface BackupManifest {
  /** 매니페스트 버전 */
  version: string;
  /** 백업 메타데이터 */
  metadata: BackupMetadata;
  /** 백업된 워크플로우 목록 */
  workflows: BackupWorkflowInfo[];
  /** credentials 제거 여부 */
  credentialsStripped: boolean;
}

/**
 * 백업 실행 옵션
 * @description 백업 실행 시 전달하는 옵션
 */
export interface BackupOptions {
  /** 백업 저장 기본 디렉토리 */
  baseDir: string;
  /** credentials 제거 여부 (기본: true) */
  stripCredentials?: boolean;
  /** 특정 워크플로우 ID 목록 (없으면 전체 백업) */
  workflowIds?: string[];
  /** 백업 설명 메모 */
  description?: string;
  /** JSON 포맷팅 여부 (기본: true) */
  prettyPrint?: boolean;
}

/**
 * 백업 실행 결과
 * @description 백업 작업의 결과 정보
 */
export interface BackupResult {
  /** 성공 여부 */
  success: boolean;
  /** 백업 ID */
  backupId: string;
  /** 백업 디렉토리 경로 */
  backupPath: string;
  /** 성공한 워크플로우 수 */
  successCount: number;
  /** 실패한 워크플로우 수 */
  failedCount: number;
  /** 실패한 워크플로우 ID 목록 */
  failedWorkflows: string[];
  /** 백업 소요 시간 (ms) */
  duration: number;
  /** 에러 메시지 (전체 실패 시) */
  error?: string;
}

/**
 * 백업 목록 아이템
 * @description 백업 목록 조회 시 반환되는 각 백업의 요약 정보
 */
export interface BackupListItem {
  /** 백업 ID */
  id: string;
  /** 백업 디렉토리 경로 */
  path: string;
  /** 백업 생성 시각 */
  timestamp: string;
  /** 환경 이름 */
  environment: string;
  /** 워크플로우 수 */
  workflowCount: number;
}
