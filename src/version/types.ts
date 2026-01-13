/**
 * 버전 관리 모듈 타입 정의
 * @description Git 기반 버전 관리 관련 TypeScript 타입 및 인터페이스 정의
 */

/**
 * Git 설정
 * @description Git 저장소 기본 설정
 */
export interface GitConfig {
  /** Git 저장소 경로 */
  repoPath: string;
}

/**
 * Git 저장소 상태
 * @description 현재 Git 저장소의 상태 정보
 */
export interface GitStatus {
  /** Git 저장소 여부 */
  isRepo: boolean;
  /** 현재 브랜치 이름 */
  branch: string;
  /** 변경 사항 없는 클린 상태 여부 */
  isClean: boolean;
  /** 스테이징된 파일 목록 */
  staged: string[];
  /** 수정된 파일 목록 (스테이징 안 됨) */
  modified: string[];
  /** 추적되지 않는 파일 목록 */
  untracked: string[];
  /** 원격 브랜치보다 앞선 커밋 수 */
  ahead: number;
  /** 원격 브랜치보다 뒤처진 커밋 수 */
  behind: number;
}

/**
 * 커밋 옵션
 * @description Git 커밋 생성 시 사용되는 옵션
 */
export interface CommitOptions {
  /** 커밋 메시지 */
  message: string;
  /** 작성자 정보 (선택) - "이름 <이메일>" 형식 */
  author?: string;
}

/**
 * 커밋 결과
 * @description Git 커밋 생성 결과 정보
 */
export interface CommitResult {
  /** 커밋 해시 (short) */
  hash: string;
  /** 커밋된 브랜치 */
  branch: string;
  /** 커밋 요약 정보 */
  summary: {
    /** 변경된 파일 수 */
    changes: number;
    /** 추가된 라인 수 */
    insertions: number;
    /** 삭제된 라인 수 */
    deletions: number;
  };
}

/**
 * 커밋 로그 항목
 * @description Git 로그에서 조회되는 개별 커밋 정보
 */
export interface CommitLogEntry {
  /** 커밋 해시 (full) */
  hash: string;
  /** 커밋 해시 (short) */
  hashShort: string;
  /** 커밋 날짜 (ISO 8601) */
  date: string;
  /** 커밋 메시지 */
  message: string;
  /** 작성자 이름 */
  authorName: string;
  /** 작성자 이메일 */
  authorEmail: string;
}

/**
 * 버전 관리 설정
 * @description 설정 파일에서 사용되는 Git 관련 설정
 */
export interface VersionControlConfig {
  /** Git 사용 여부 */
  enabled: boolean;
  /** Git 저장소 경로 (기본: backup.directory) */
  repoPath?: string;
  /** 자동 커밋 여부 */
  autoCommit?: boolean;
  /** 커밋 메시지 템플릿 */
  commitMessageTemplate?: string;
  /** .gitignore에 추가할 패턴 */
  ignorePatterns?: string[];
}

// ============================================================
// 변경 감지 관련 타입
// ============================================================

/**
 * 변경 유형
 * @description 워크플로우 파일의 변경 유형
 */
export type ChangeType = 'added' | 'modified' | 'deleted';

/**
 * 워크플로우 변경 정보
 * @description 개별 워크플로우 파일의 변경 감지 결과
 */
export interface WorkflowChange {
  /** 워크플로우 ID */
  workflowId: string;
  /** 워크플로우 이름 */
  workflowName: string;
  /** 파일 경로 (상대 경로) */
  filePath: string;
  /** 변경 유형 */
  changeType: ChangeType;
}

/**
 * 변경 감지 결과
 * @description 전체 변경 감지 작업의 결과
 */
export interface ChangeDetectionResult {
  /** 감지된 변경 목록 */
  changes: WorkflowChange[];
  /** 변경 사항 존재 여부 */
  hasChanges: boolean;
  /** 감지 시점 타임스탬프 (ISO 8601) */
  timestamp: string;
}

/**
 * 워크플로우 요약 정보
 * @description 워크플로우 파일에서 추출한 주요 정보
 */
export interface WorkflowSummary {
  /** 워크플로우 ID */
  id: string;
  /** 워크플로우 이름 */
  name: string;
  /** 노드 개수 */
  nodeCount: number;
  /** 활성화 상태 */
  active: boolean;
  /** 태그 목록 */
  tags?: string[];
}

// ============================================================
// 워크플로우 비교(Diff) 관련 타입
// ============================================================

/**
 * 노드 변경 유형
 */
export type NodeChangeType = 'added' | 'removed' | 'modified';

/**
 * 연결 변경 유형
 */
export type ConnectionChangeType = 'added' | 'removed';

/**
 * 노드 diff 정보
 * @description 워크플로우 비교 시 개별 노드의 변경 정보
 */
export interface NodeDiff {
  /** 노드 ID */
  nodeId: string;
  /** 노드 이름 */
  nodeName: string;
  /** 노드 타입 */
  nodeType: string;
  /** 변경 유형 */
  changeType: NodeChangeType;
  /** 변경 상세 내용 (수정된 경우) */
  details?: string[];
}

/**
 * 연결 diff 정보
 * @description 워크플로우 비교 시 노드 간 연결의 변경 정보
 */
export interface ConnectionDiff {
  /** 출발 노드 이름 */
  from: string;
  /** 도착 노드 이름 */
  to: string;
  /** 변경 유형 */
  changeType: ConnectionChangeType;
}

/**
 * 워크플로우 diff 결과
 * @description 두 워크플로우 버전 간 차이점 정보
 */
export interface WorkflowDiff {
  /** 워크플로우 ID */
  workflowId: string;
  /** 워크플로우 이름 */
  workflowName: string;
  /** 노드 변경 목록 */
  nodes: NodeDiff[];
  /** 연결 변경 목록 */
  connections: ConnectionDiff[];
  /** 설정 변경 여부 */
  settingsChanged: boolean;
  /** 변경 요약 */
  summary: {
    /** 추가된 노드 수 */
    nodesAdded: number;
    /** 삭제된 노드 수 */
    nodesRemoved: number;
    /** 수정된 노드 수 */
    nodesModified: number;
    /** 추가된 연결 수 */
    connectionsAdded: number;
    /** 삭제된 연결 수 */
    connectionsRemoved: number;
  };
}

// ============================================================
// 자동 커밋 관련 타입
// ============================================================

/**
 * 자동 커밋 옵션
 * @description 자동 커밋 수행 시 사용되는 옵션
 */
export interface AutoCommitOptions {
  /** 커밋 메시지 (생략 시 자동 생성) */
  message?: string;
  /** 추적되지 않는 파일 포함 여부 (기본: true) */
  includeUntracked?: boolean;
}

/**
 * 자동 커밋 결과
 * @description 자동 커밋 수행 결과 정보
 */
export interface AutoCommitResult {
  /** 커밋 성공 여부 */
  success: boolean;
  /** 커밋 해시 (변경 없으면 null) */
  hash: string | null;
  /** 커밋 메시지 */
  message: string;
  /** 변경된 파일 목록 */
  changedFiles: string[];
}

/**
 * 커밋 이력 조회 옵션
 * @description 커밋 이력 조회 시 사용되는 필터 옵션
 */
export interface HistoryOptions {
  /** 조회할 커밋 개수 (기본: 20) */
  limit?: number;
  /** 특정 워크플로우 ID로 필터링 */
  workflowId?: string;
}
