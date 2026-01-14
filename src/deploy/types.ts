/**
 * 배포 파이프라인 타입 정의
 * @description 배포 작업의 타입 안전성 확보를 위한 타입 정의
 */

/**
 * 배포 대상 설정
 * @description 소스 환경에서 대상 환경으로 배포할 대상 정의
 */
export interface DeploymentTarget {
  /** 소스 환경 이름 (예: "dev") */
  sourceEnv: string;
  /** 대상 환경 이름 (예: "prod") */
  targetEnv: string;
  /** 특정 워크플로우 ID 목록 (없으면 전체 배포) */
  workflowIds?: string[];
}

/**
 * 배포 옵션
 * @description 배포 실행 시 적용할 옵션
 */
export interface DeploymentOptions {
  /** 시뮬레이션 모드 - 실제 배포 없이 검증만 수행 */
  dryRun: boolean;
  /** 검증 단계 생략 */
  skipValidation: boolean;
  /** 배포 후 워크플로우 활성화 */
  activateAfterDeploy: boolean;
  /** 기존 워크플로우 덮어쓰기 */
  overwrite: boolean;
  /** 배포 전 대상 환경 백업 생성 */
  createBackup: boolean;
}

/**
 * 배포된 워크플로우 정보
 * @description 개별 워크플로우의 배포 결과
 */
export interface DeployedWorkflow {
  /** 원본 워크플로우 ID */
  workflowId: string;
  /** 워크플로우 이름 */
  workflowName: string;
  /** 대상 환경의 워크플로우 ID */
  targetId: string;
  /** 수행된 작업 유형 */
  action: 'created' | 'updated' | 'skipped';
  /** 변환된 credential 개수 */
  credentialsTransformed: number;
}

/**
 * 배포 요약 통계
 * @description 배포 작업 전체 통계
 */
export interface DeploymentSummary {
  /** 전체 워크플로우 수 */
  total: number;
  /** 신규 생성된 워크플로우 수 */
  created: number;
  /** 업데이트된 워크플로우 수 */
  updated: number;
  /** 건너뛴 워크플로우 수 */
  skipped: number;
  /** 실패한 워크플로우 수 */
  failed: number;
}

/**
 * 배포 에러 정보
 * @description 배포 과정에서 발생한 에러 상세
 */
export interface DeploymentError {
  /** 워크플로우 ID */
  workflowId: string;
  /** 워크플로우 이름 */
  workflowName: string;
  /** 에러 발생 단계 */
  phase: 'validation' | 'transform' | 'deploy' | 'verify';
  /** 에러 메시지 */
  message: string;
}

/**
 * 배포 결과
 * @description 배포 파이프라인 실행 결과
 */
export interface DeploymentResult {
  /** 배포 성공 여부 */
  success: boolean;
  /** 배포 실행 시각 (ISO 형식) */
  timestamp: string;
  /** 소스 환경 이름 */
  sourceEnv: string;
  /** 대상 환경 이름 */
  targetEnv: string;
  /** 배포된 워크플로우 목록 */
  workflows: DeployedWorkflow[];
  /** 배포 요약 통계 */
  summary: DeploymentSummary;
  /** 발생한 에러 목록 */
  errors: DeploymentError[];
}

/**
 * 기본 배포 옵션
 * @description 배포 시 적용되는 기본 옵션 값
 */
export const DEFAULT_DEPLOYMENT_OPTIONS: DeploymentOptions = {
  dryRun: false,
  skipValidation: false,
  activateAfterDeploy: false,
  overwrite: false,
  createBackup: true,
};

/**
 * 배포 기록
 * @description 배포 이력 및 롤백을 위한 정보 저장
 */
export interface DeploymentRecord {
  /** 배포 ID (타임스탬프 기반) */
  id: string;
  /** 배포 시각 (ISO 형식) */
  timestamp: string;
  /** 소스 환경 이름 */
  sourceEnv: string;
  /** 대상 환경 이름 */
  targetEnv: string;
  /** 배포된 워크플로우 정보 */
  workflows: {
    /** 소스 환경의 원본 워크플로우 ID */
    originalId: string;
    /** 대상 환경의 워크플로우 ID */
    targetId: string;
    /** 대상 환경의 이전 워크플로우 ID (업데이트 시) */
    previousTargetId?: string;
  }[];
  /** 배포 전 백업 경로 */
  backupPath?: string;
}
