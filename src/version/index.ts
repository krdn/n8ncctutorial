/**
 * version 모듈 인덱스
 * @description Git 기반 버전 관리 기능 제공
 */

// 타입 재내보내기
export type {
  GitConfig,
  GitStatus,
  CommitOptions,
  CommitResult,
  CommitLogEntry,
  VersionControlConfig,
  // 변경 감지 관련 타입
  ChangeType,
  WorkflowChange,
  ChangeDetectionResult,
  WorkflowSummary,
  // 워크플로우 비교 관련 타입
  NodeChangeType,
  ConnectionChangeType,
  NodeDiff,
  ConnectionDiff,
  WorkflowDiff,
  // 자동 커밋 관련 타입
  AutoCommitOptions,
  AutoCommitResult,
  HistoryOptions,
} from './types.js';

// Git 연동 함수 재내보내기
export {
  GitError,
  initRepo,
  isGitRepo,
  getRepoStatus,
  stageFiles,
  commitChanges,
  getCommitLog,
} from './git.js';

// 변경 감지 함수 재내보내기
export {
  detectChanges,
  parseWorkflowFromFile,
  getWorkflowSummary,
} from './watch.js';

// 워크플로우 diff 함수 재내보내기
export {
  compareWorkflows,
  getWorkflowAtCommit,
  readWorkflowFile,
  formatDiff,
  formatDiffAsJson,
} from './diff.js';

// 자동 커밋 함수 재내보내기
export {
  generateCommitMessage,
  autoCommit,
  getHistory,
} from './commit.js';
