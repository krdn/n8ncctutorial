/**
 * 복원 모듈 타입 정의
 * @description 복원 관련 TypeScript 타입 및 인터페이스 정의
 */

/**
 * 복원 모드
 * @description 복원 시 충돌 처리 방법
 */
export type RestoreMode = 'skip' | 'overwrite' | 'rename';

/**
 * 복원 실행 옵션
 * @description 복원 실행 시 전달하는 옵션
 */
export interface RestoreOptions {
  /** 복원 모드 (충돌 시 처리 방법) */
  mode: RestoreMode;
  /** 복원 후 활성화 여부 */
  activate: boolean;
  /** 특정 워크플로우 ID 목록 (없으면 전체 복원) */
  targetIds?: string[];
  /** 드라이런 모드 (실제 복원 없이 시뮬레이션) */
  dryRun?: boolean;
}

/**
 * 개별 워크플로우 복원 결과
 * @description 각 워크플로우의 복원 결과
 */
export interface RestoreWorkflowResult {
  /** 원본 워크플로우 ID */
  originalId: string;
  /** 복원된 워크플로우 ID (생성/덮어쓰기된 ID) */
  restoredId?: string;
  /** 워크플로우 이름 */
  name: string;
  /** 성공 여부 */
  success: boolean;
  /** 수행된 액션 (created, updated, skipped, renamed) */
  action?: 'created' | 'updated' | 'skipped' | 'renamed';
  /** 에러 메시지 (실패 시) */
  error?: string;
}

/**
 * 복원 실행 결과
 * @description 전체 복원 작업의 결과
 */
export interface RestoreResult {
  /** 전체 성공 여부 (모든 워크플로우 성공) */
  success: boolean;
  /** 백업 ID */
  backupId: string;
  /** 복원 시도된 총 워크플로우 수 */
  totalCount: number;
  /** 성공한 워크플로우 수 */
  successCount: number;
  /** 실패한 워크플로우 수 */
  failedCount: number;
  /** 건너뛴 워크플로우 수 */
  skippedCount: number;
  /** 개별 워크플로우 결과 목록 */
  workflows: RestoreWorkflowResult[];
  /** 복원 소요 시간 (ms) */
  duration: number;
  /** 전체 실패 시 에러 메시지 */
  error?: string;
}

/**
 * 백업 상세 정보 포맷팅 결과
 * @description formatBackupDetail 함수의 반환 타입
 */
export interface FormattedBackupDetail {
  /** 백업 ID */
  id: string;
  /** 생성 시각 (포맷된 문자열) */
  timestamp: string;
  /** 환경 이름 */
  environment: string;
  /** n8n URL */
  n8nUrl: string;
  /** 워크플로우 총 개수 */
  workflowCount: number;
  /** 설명 (있는 경우) */
  description?: string;
  /** 생성자 (있는 경우) */
  createdBy?: string;
  /** credentials 제거 여부 */
  credentialsStripped: boolean;
  /** 워크플로우 목록 */
  workflows: {
    id: string;
    name: string;
    active: boolean;
    updatedAt: string;
  }[];
}
