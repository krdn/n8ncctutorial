/**
 * Git 연동 모듈
 * @description simple-git 라이브러리를 래핑하여 Git 작업을 수행하는 함수들
 */

import { simpleGit, type SimpleGit } from 'simple-git';
import * as fs from 'fs';
import * as path from 'path';
import type { GitStatus, CommitOptions, CommitResult, CommitLogEntry } from './types.js';

/**
 * Git 관련 에러 클래스
 */
export class GitError extends Error {
  constructor(
    message: string,
    public readonly operation: string,
    public readonly repoPath: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'GitError';
  }
}

/** 기본 .gitignore 내용 */
const DEFAULT_GITIGNORE = `# n8n Workflow Manager
# 민감 정보 제외

# Credentials 파일
*credentials*
*.credentials.json

# 환경 변수 파일
.env
.env.*
!.env.example

# OS 생성 파일
.DS_Store
Thumbs.db

# 편집기 설정
.vscode/
.idea/
*.swp
*.swo

# 로그 파일
*.log

# 임시 파일
*.tmp
*.temp
`;

/**
 * Git 인스턴스 생성
 * @param repoPath - 저장소 경로
 * @returns simple-git 인스턴스
 */
function createGitInstance(repoPath: string): SimpleGit {
  return simpleGit({
    baseDir: repoPath,
    binary: 'git',
    maxConcurrentProcesses: 6,
    trimmed: false,
  });
}

/**
 * Git 저장소 초기화
 * @description 지정된 경로에 Git 저장소를 초기화하고 기본 .gitignore 파일 생성
 * @param repoPath - 저장소 경로
 * @returns 초기화 성공 여부
 * @throws {GitError} 초기화 실패 시
 */
export async function initRepo(repoPath: string): Promise<boolean> {
  try {
    // 디렉토리 생성 (없으면)
    if (!fs.existsSync(repoPath)) {
      fs.mkdirSync(repoPath, { recursive: true });
    }

    const git = createGitInstance(repoPath);

    // Git 저장소 초기화
    await git.init();

    // 한글 파일명 지원을 위한 설정
    await git.addConfig('core.quotepath', 'false');

    // .gitignore 파일 생성 (없으면)
    const gitignorePath = path.join(repoPath, '.gitignore');
    if (!fs.existsSync(gitignorePath)) {
      fs.writeFileSync(gitignorePath, DEFAULT_GITIGNORE, 'utf-8');
    }

    return true;
  } catch (error) {
    throw new GitError(
      `Git 저장소 초기화 실패: ${error instanceof Error ? error.message : String(error)}`,
      'init',
      repoPath,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Git 저장소 여부 확인
 * @description 지정된 경로가 Git 저장소인지 확인
 * @param repoPath - 확인할 경로
 * @returns Git 저장소 여부
 */
export async function isGitRepo(repoPath: string): Promise<boolean> {
  try {
    if (!fs.existsSync(repoPath)) {
      return false;
    }

    const git = createGitInstance(repoPath);
    return await git.checkIsRepo();
  } catch {
    return false;
  }
}

/**
 * Git 저장소 상태 조회
 * @description 현재 저장소의 상태 정보 (브랜치, 변경 파일 등) 조회
 * @param repoPath - 저장소 경로
 * @returns Git 상태 정보
 * @throws {GitError} 상태 조회 실패 시
 */
export async function getRepoStatus(repoPath: string): Promise<GitStatus> {
  try {
    const isRepo = await isGitRepo(repoPath);
    if (!isRepo) {
      return {
        isRepo: false,
        branch: '',
        isClean: true,
        staged: [],
        modified: [],
        untracked: [],
        ahead: 0,
        behind: 0,
      };
    }

    const git = createGitInstance(repoPath);
    const status = await git.status();

    return {
      isRepo: true,
      branch: status.current || 'HEAD',
      isClean: status.isClean(),
      staged: status.staged,
      modified: status.modified,
      untracked: status.not_added,
      ahead: status.ahead,
      behind: status.behind,
    };
  } catch (error) {
    throw new GitError(
      `저장소 상태 조회 실패: ${error instanceof Error ? error.message : String(error)}`,
      'status',
      repoPath,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * 파일 스테이징
 * @description 지정된 파일들을 Git 스테이징 영역에 추가
 * @param repoPath - 저장소 경로
 * @param files - 스테이징할 파일 목록 (빈 배열이면 전체)
 * @returns 스테이징 성공 여부
 * @throws {GitError} 스테이징 실패 시
 */
export async function stageFiles(repoPath: string, files: string[] = []): Promise<boolean> {
  try {
    const git = createGitInstance(repoPath);

    if (files.length === 0) {
      // 전체 파일 스테이징
      await git.add('.');
    } else {
      // 지정된 파일만 스테이징
      await git.add(files);
    }

    return true;
  } catch (error) {
    throw new GitError(
      `파일 스테이징 실패: ${error instanceof Error ? error.message : String(error)}`,
      'stage',
      repoPath,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * 변경 사항 커밋
 * @description 스테이징된 변경 사항을 커밋
 * @param repoPath - 저장소 경로
 * @param options - 커밋 옵션 (메시지, 작성자)
 * @returns 커밋 결과 정보
 * @throws {GitError} 커밋 실패 시
 */
export async function commitChanges(
  repoPath: string,
  options: CommitOptions
): Promise<CommitResult> {
  try {
    const git = createGitInstance(repoPath);

    // 커밋 실행 (author 옵션 포함 시 raw 명령어 사용)
    let result;
    if (options.author) {
      result = await git.raw([
        'commit',
        '-m',
        options.message,
        '--author',
        options.author,
      ]);
      // raw 명령어 결과 파싱
      const match = result.match(/\[(\S+)\s+([a-f0-9]+)\]/);
      const branch = match ? match[1] : 'unknown';
      const hash = match ? match[2] : '';

      // 변경 정보 추출
      const changesMatch = result.match(/(\d+) files? changed/);
      const insertionsMatch = result.match(/(\d+) insertions?/);
      const deletionsMatch = result.match(/(\d+) deletions?/);

      return {
        hash,
        branch,
        summary: {
          changes: changesMatch ? parseInt(changesMatch[1], 10) : 0,
          insertions: insertionsMatch ? parseInt(insertionsMatch[1], 10) : 0,
          deletions: deletionsMatch ? parseInt(deletionsMatch[1], 10) : 0,
        },
      };
    } else {
      result = await git.commit(options.message);
      return {
        hash: result.commit,
        branch: result.branch,
        summary: {
          changes: result.summary.changes,
          insertions: result.summary.insertions,
          deletions: result.summary.deletions,
        },
      };
    }
  } catch (error) {
    throw new GitError(
      `커밋 실패: ${error instanceof Error ? error.message : String(error)}`,
      'commit',
      repoPath,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * 커밋 이력 조회
 * @description 최근 커밋 이력을 조회
 * @param repoPath - 저장소 경로
 * @param limit - 조회할 커밋 수 (기본: 10)
 * @returns 커밋 로그 목록
 * @throws {GitError} 로그 조회 실패 시
 */
export async function getCommitLog(
  repoPath: string,
  limit: number = 10
): Promise<CommitLogEntry[]> {
  try {
    const git = createGitInstance(repoPath);

    const log = await git.log({
      maxCount: limit,
      format: {
        hash: '%H',
        hashShort: '%h',
        date: '%aI',
        message: '%s',
        authorName: '%an',
        authorEmail: '%ae',
      },
    });

    return log.all.map((entry) => ({
      hash: entry.hash,
      hashShort: entry.hashShort || entry.hash.substring(0, 7),
      date: entry.date,
      message: entry.message,
      authorName: entry.authorName || '',
      authorEmail: entry.authorEmail || '',
    }));
  } catch (error) {
    // 커밋이 없는 경우 빈 배열 반환
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('does not have any commits')) {
      return [];
    }

    throw new GitError(
      `커밋 이력 조회 실패: ${errorMessage}`,
      'log',
      repoPath,
      error instanceof Error ? error : undefined
    );
  }
}
