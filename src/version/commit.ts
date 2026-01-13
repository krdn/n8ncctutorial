/**
 * 자동 커밋 모듈
 * @description 변경 감지 기반 자동 커밋 및 커밋 이력 조회 기능
 */

import { stageFiles, commitChanges, getCommitLog, getRepoStatus } from './git.js';
import { detectChanges } from './watch.js';
import type {
  AutoCommitOptions,
  AutoCommitResult,
  HistoryOptions,
  CommitLogEntry,
  ChangeDetectionResult,
} from './types.js';

/**
 * 커밋 메시지 자동 생성
 * @description 변경 감지 결과를 기반으로 의미 있는 커밋 메시지 생성
 * @param changes - 변경 감지 결과
 * @returns 생성된 커밋 메시지
 */
export function generateCommitMessage(changes: ChangeDetectionResult): string {
  if (!changes.hasChanges || changes.changes.length === 0) {
    return 'backup: no changes';
  }

  // 변경 유형별 분류
  const added = changes.changes.filter((c) => c.changeType === 'added');
  const modified = changes.changes.filter((c) => c.changeType === 'modified');
  const deleted = changes.changes.filter((c) => c.changeType === 'deleted');

  const parts: string[] = [];

  // 추가된 워크플로우
  if (added.length > 0) {
    const names = added.map((c) => c.workflowName);
    const displayNames = getDisplayNames(names);
    parts.push(`${added.length} workflow(s) added (${displayNames})`);
  }

  // 수정된 워크플로우
  if (modified.length > 0) {
    const names = modified.map((c) => c.workflowName);
    const displayNames = getDisplayNames(names);
    parts.push(`${modified.length} workflow(s) updated (${displayNames})`);
  }

  // 삭제된 워크플로우
  if (deleted.length > 0) {
    const names = deleted.map((c) => c.workflowName);
    const displayNames = getDisplayNames(names);
    parts.push(`${deleted.length} workflow(s) deleted (${displayNames})`);
  }

  // 메시지 구성
  const totalCount = changes.changes.length;
  if (parts.length === 1) {
    // 단일 유형 변경
    return `backup: ${parts[0]}`;
  }

  // 복합 변경
  return `backup: ${totalCount} workflows changed\n\n${parts.join('\n')}`;
}

/**
 * 표시용 이름 목록 생성
 * @description 최대 3개까지 이름을 표시하고 나머지는 "... and N more"로 표시
 * @param names - 워크플로우 이름 목록
 * @returns 표시용 문자열
 */
function getDisplayNames(names: string[]): string {
  const maxDisplay = 3;

  if (names.length <= maxDisplay) {
    return names.join(', ');
  }

  const displayed = names.slice(0, maxDisplay);
  const remaining = names.length - maxDisplay;
  return `${displayed.join(', ')}, ... and ${remaining} more`;
}

/**
 * 자동 커밋 수행
 * @description 변경 감지 후 자동으로 스테이징 및 커밋 수행
 * @param repoPath - Git 저장소 경로
 * @param options - 자동 커밋 옵션
 * @returns 자동 커밋 결과
 */
export async function autoCommit(
  repoPath: string,
  options: AutoCommitOptions = {}
): Promise<AutoCommitResult> {
  const { message, includeUntracked = true } = options;

  // 변경 감지
  const changes = await detectChanges(repoPath);

  // 변경 사항 없으면 조기 반환
  if (!changes.hasChanges) {
    return {
      success: true,
      hash: null,
      message: 'No changes to commit',
      changedFiles: [],
    };
  }

  // 추적되지 않는 파일 제외 옵션 처리
  let filteredChanges = changes;
  if (!includeUntracked) {
    const trackedChanges = changes.changes.filter((c) => c.changeType !== 'added');
    filteredChanges = {
      ...changes,
      changes: trackedChanges,
      hasChanges: trackedChanges.length > 0,
    };

    // 추적되지 않는 파일 제외 후 변경 사항 없으면 조기 반환
    if (!filteredChanges.hasChanges) {
      return {
        success: true,
        hash: null,
        message: 'No tracked changes to commit',
        changedFiles: [],
      };
    }
  }

  // 커밋 메시지 결정 (사용자 지정 또는 자동 생성)
  const commitMessage = message || generateCommitMessage(filteredChanges);

  // 파일 스테이징
  // includeUntracked 옵션에 따라 스테이징할 파일 결정
  if (includeUntracked) {
    // 전체 파일 스테이징
    await stageFiles(repoPath, []);
  } else {
    // 추적 중인 파일만 스테이징 (수정/삭제된 파일)
    const filesToStage = filteredChanges.changes.map((c) => c.filePath);
    await stageFiles(repoPath, filesToStage);
  }

  // 커밋 수행
  const result = await commitChanges(repoPath, { message: commitMessage });

  // 변경된 파일 목록 생성
  const changedFiles = filteredChanges.changes.map((c) => c.filePath);

  return {
    success: true,
    hash: result.hash,
    message: commitMessage,
    changedFiles,
  };
}

/**
 * 커밋 이력 조회
 * @description 커밋 이력을 조회하고 선택적으로 워크플로우 ID로 필터링
 * @param repoPath - Git 저장소 경로
 * @param options - 조회 옵션
 * @returns 커밋 로그 목록
 */
export async function getHistory(
  repoPath: string,
  options: HistoryOptions = {}
): Promise<CommitLogEntry[]> {
  const { limit = 20, workflowId } = options;

  // 기본 커밋 이력 조회
  // 워크플로우 ID 필터가 있으면 더 많이 조회 후 필터링
  const fetchLimit = workflowId ? limit * 5 : limit;
  const commits = await getCommitLog(repoPath, fetchLimit);

  // 워크플로우 ID로 필터링
  if (workflowId) {
    const filtered = commits.filter((commit) => {
      // 커밋 메시지에 워크플로우 ID나 관련 정보가 포함되어 있는지 확인
      const messageIncludesId = commit.message.toLowerCase().includes(workflowId.toLowerCase());
      return messageIncludesId;
    });

    // 요청한 limit만큼 반환
    return filtered.slice(0, limit);
  }

  return commits;
}
