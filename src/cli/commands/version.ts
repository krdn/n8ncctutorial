/**
 * version 명령어 모듈
 * @description Git 기반 워크플로우 버전 관리 CLI 명령어
 */

import type { Command } from 'commander';
import * as path from 'path';
import {
  loadConfig,
  configExists,
  findConfigPath,
} from '../../config/index.js';
import {
  initRepo,
  isGitRepo,
  getRepoStatus,
  getCommitLog,
  GitError,
  compareWorkflows,
  getWorkflowAtCommit,
  readWorkflowFile,
  formatDiff,
  formatDiffAsJson,
  autoCommit,
  getHistory,
  detectChanges,
} from '../../version/index.js';

/**
 * 설정 파일 없음 안내 출력
 */
function printNoConfigMessage(): void {
  console.log('Error: Configuration not found');
  console.log('');
  console.log('To get started:');
  console.log('  1. Copy config.example.yaml to n8n-wfm.config.yaml');
  console.log('  2. Edit the file with your n8n instance details');
  console.log('  3. Set environment variables for API keys');
  console.log('');
  console.log('Or use: n8n-wfm config init');
}

/**
 * 저장소 경로 결정
 * @description CLI 옵션, 설정 파일 순으로 경로 결정
 * @param cliPath - CLI로 전달된 경로
 * @param configPath - 설정 파일 경로
 * @returns 결정된 저장소 경로
 */
function resolveRepoPath(cliPath?: string, configPath?: string): string {
  // 1. CLI로 직접 지정된 경로 우선
  if (cliPath) {
    return path.resolve(cliPath);
  }

  // 2. 설정 파일에서 백업 디렉토리 사용
  if (configExists(configPath)) {
    try {
      const config = loadConfig(configPath);
      if (config.backup?.baseDir) {
        return path.resolve(config.backup.baseDir);
      }
    } catch {
      // 설정 로드 실패 시 기본값 사용
    }
  }

  // 3. 기본값
  return path.resolve('./backups');
}

/**
 * version 명령어 등록
 * @param program - Commander 프로그램 인스턴스
 */
export function registerVersionCommand(program: Command): void {
  const versionCmd = program
    .command('version')
    .description('워크플로우 버전 관리 (Git)');

  // version init 하위 명령어
  versionCmd
    .command('init [path]')
    .description('Git 저장소 초기화')
    .option('-c, --config <path>', '설정 파일 경로 지정')
    .option('--force', '기존 저장소 재초기화')
    .action(async (pathArg: string | undefined, options: { config?: string; force?: boolean }) => {
      try {
        const repoPath = resolveRepoPath(pathArg, options.config);

        console.log(`Repository path: ${repoPath}`);

        // 기존 저장소 확인
        const existingRepo = await isGitRepo(repoPath);
        if (existingRepo && !options.force) {
          console.log('');
          console.log('Git repository already exists.');
          console.log('Use --force to reinitialize.');
          return;
        }

        if (existingRepo && options.force) {
          console.log('Reinitializing existing repository...');
        } else {
          console.log('Initializing new Git repository...');
        }

        await initRepo(repoPath);

        console.log('');
        console.log('Git repository initialized successfully!');
        console.log('');
        console.log('Created files:');
        console.log('  .gitignore - Default ignore patterns');
        console.log('');
        console.log('Next steps:');
        console.log('  1. Run backup to create workflow files');
        console.log('  2. Use "n8n-wfm version status" to check changes');
      } catch (error) {
        if (error instanceof GitError) {
          console.log(`Error: ${error.message}`);
          console.log(`  Operation: ${error.operation}`);
          console.log(`  Path: ${error.repoPath}`);
        } else {
          const message = error instanceof Error ? error.message : String(error);
          console.log(`Error: ${message}`);
        }
        process.exitCode = 1;
      }
    });

  // version status 하위 명령어
  versionCmd
    .command('status')
    .description('저장소 상태 확인')
    .option('-c, --config <path>', '설정 파일 경로 지정')
    .option('-p, --path <path>', '저장소 경로 지정')
    .action(async (options: { config?: string; path?: string }) => {
      try {
        const repoPath = resolveRepoPath(options.path, options.config);

        console.log(`Repository: ${repoPath}`);
        console.log('');

        const status = await getRepoStatus(repoPath);

        if (!status.isRepo) {
          console.log('Not a Git repository.');
          console.log('');
          console.log('Run "n8n-wfm version init" to initialize.');
          return;
        }

        console.log(`Branch: ${status.branch}`);
        console.log(`Status: ${status.isClean ? 'Clean' : 'Has changes'}`);

        if (status.ahead > 0 || status.behind > 0) {
          console.log('');
          if (status.ahead > 0) {
            console.log(`  Ahead: ${status.ahead} commit(s)`);
          }
          if (status.behind > 0) {
            console.log(`  Behind: ${status.behind} commit(s)`);
          }
        }

        if (!status.isClean) {
          console.log('');
          console.log('Changes:');

          if (status.staged.length > 0) {
            console.log(`  Staged: ${status.staged.length} file(s)`);
            status.staged.slice(0, 5).forEach((f) => {
              console.log(`    + ${f}`);
            });
            if (status.staged.length > 5) {
              console.log(`    ... and ${status.staged.length - 5} more`);
            }
          }

          if (status.modified.length > 0) {
            console.log(`  Modified: ${status.modified.length} file(s)`);
            status.modified.slice(0, 5).forEach((f) => {
              console.log(`    M ${f}`);
            });
            if (status.modified.length > 5) {
              console.log(`    ... and ${status.modified.length - 5} more`);
            }
          }

          if (status.untracked.length > 0) {
            console.log(`  Untracked: ${status.untracked.length} file(s)`);
            status.untracked.slice(0, 5).forEach((f) => {
              console.log(`    ? ${f}`);
            });
            if (status.untracked.length > 5) {
              console.log(`    ... and ${status.untracked.length - 5} more`);
            }
          }
        }
      } catch (error) {
        if (error instanceof GitError) {
          console.log(`Error: ${error.message}`);
          console.log(`  Operation: ${error.operation}`);
        } else {
          const message = error instanceof Error ? error.message : String(error);
          console.log(`Error: ${message}`);
        }
        process.exitCode = 1;
      }
    });

  // version log 하위 명령어
  versionCmd
    .command('log')
    .description('커밋 이력 조회')
    .option('-c, --config <path>', '설정 파일 경로 지정')
    .option('-p, --path <path>', '저장소 경로 지정')
    .option('-n, --limit <count>', '조회할 커밋 수', '20')
    .option('-w, --workflow <id>', '특정 워크플로우 관련 커밋만 필터')
    .action(async (options: { config?: string; path?: string; limit: string; workflow?: string }) => {
      try {
        const repoPath = resolveRepoPath(options.path, options.config);
        const limit = parseInt(options.limit, 10) || 20;

        console.log(`Repository: ${repoPath}`);
        if (options.workflow) {
          console.log(`Filter: workflow ${options.workflow}`);
        }
        console.log('');

        // 저장소 확인
        const isRepo = await isGitRepo(repoPath);
        if (!isRepo) {
          console.log('Not a Git repository.');
          console.log('');
          console.log('Run "n8n-wfm version init" to initialize.');
          return;
        }

        // getHistory 함수 사용 (워크플로우 필터링 지원)
        const commits = await getHistory(repoPath, {
          limit,
          workflowId: options.workflow,
        });

        if (commits.length === 0) {
          if (options.workflow) {
            console.log(`No commits found for workflow "${options.workflow}".`);
          } else {
            console.log('No commits yet.');
            console.log('');
            console.log('Create a backup and commit changes to start tracking.');
          }
          return;
        }

        console.log(`Recent commits (showing ${commits.length}):`);
        console.log('');

        for (const commit of commits) {
          const date = new Date(commit.date).toLocaleString();
          // 커밋 해시 7자리, 날짜, 메시지 표시
          console.log(`  ${commit.hashShort}  ${date}`);
          console.log(`           ${commit.message}`);
          console.log(`           by ${commit.authorName}`);
          console.log('');
        }
      } catch (error) {
        if (error instanceof GitError) {
          console.log(`Error: ${error.message}`);
          console.log(`  Operation: ${error.operation}`);
        } else {
          const message = error instanceof Error ? error.message : String(error);
          console.log(`Error: ${message}`);
        }
        process.exitCode = 1;
      }
    });

  // version commit 하위 명령어
  versionCmd
    .command('commit [path]')
    .description('변경 사항 커밋')
    .option('-c, --config <path>', '설정 파일 경로 지정')
    .option('-m, --message <msg>', '커밋 메시지 (생략 시 자동 생성)')
    .option('--dry-run', '실제 커밋 없이 변경 사항만 표시')
    .action(
      async (
        pathArg: string | undefined,
        options: { config?: string; message?: string; dryRun?: boolean }
      ) => {
        try {
          const repoPath = resolveRepoPath(pathArg, options.config);

          console.log(`Repository: ${repoPath}`);
          console.log('');

          // 저장소 확인
          const isRepo = await isGitRepo(repoPath);
          if (!isRepo) {
            console.log('Not a Git repository.');
            console.log('');
            console.log('Run "n8n-wfm version init" to initialize.');
            return;
          }

          // dry-run 모드: 변경 사항만 표시
          if (options.dryRun) {
            const changes = await detectChanges(repoPath);

            if (!changes.hasChanges) {
              console.log('No changes to commit.');
              return;
            }

            console.log('Changes to be committed (dry-run):');
            console.log('');

            changes.changes.forEach((change) => {
              const typeLabel =
                change.changeType === 'added' ? '+' :
                change.changeType === 'modified' ? 'M' :
                change.changeType === 'deleted' ? 'D' : '?';
              console.log(`  ${typeLabel} ${change.filePath}`);
              console.log(`    Workflow: ${change.workflowName} (${change.workflowId})`);
            });

            console.log('');
            console.log(`Total: ${changes.changes.length} file(s)`);
            console.log('');
            console.log('Run without --dry-run to commit these changes.');
            return;
          }

          // 자동 커밋 수행
          const result = await autoCommit(repoPath, {
            message: options.message,
            includeUntracked: true,
          });

          if (!result.hash) {
            console.log('No changes to commit.');
            return;
          }

          console.log('Commit successful!');
          console.log('');
          console.log(`  Hash: ${result.hash}`);
          console.log(`  Files: ${result.changedFiles.length}`);
          console.log('');
          console.log('Message:');
          // 멀티라인 메시지 처리
          for (const line of result.message.split('\n')) {
            console.log(`  ${line}`);
          }
          console.log('');
          console.log('Changed files:');
          for (const file of result.changedFiles.slice(0, 10)) {
            console.log(`  - ${file}`);
          }
          if (result.changedFiles.length > 10) {
            console.log(`  ... and ${result.changedFiles.length - 10} more`);
          }
        } catch (error) {
          if (error instanceof GitError) {
            console.log(`Error: ${error.message}`);
            console.log(`  Operation: ${error.operation}`);
          } else {
            const message = error instanceof Error ? error.message : String(error);
            console.log(`Error: ${message}`);
          }
          process.exitCode = 1;
        }
      }
    );

  // version diff 하위 명령어
  versionCmd
    .command('diff <file>')
    .description('워크플로우 변경 내용 비교')
    .option('-c, --config <path>', '설정 파일 경로 지정')
    .option('-p, --path <path>', '저장소 경로 지정')
    .option('--commit <hash>', '특정 커밋과 비교')
    .option('--commits <hashes>', '두 커밋 간 비교 (hash1,hash2 형식)')
    .option('-s, --summary', '요약만 표시')
    .option('--json', 'JSON 형식으로 출력')
    .option('-v, --verbose', '상세 변경 내용 표시')
    .action(
      async (
        file: string,
        options: {
          config?: string;
          path?: string;
          commit?: string;
          commits?: string;
          summary?: boolean;
          json?: boolean;
          verbose?: boolean;
        }
      ) => {
        try {
          const repoPath = resolveRepoPath(options.path, options.config);

          // 저장소 확인
          const isRepo = await isGitRepo(repoPath);
          if (!isRepo) {
            console.log('Not a Git repository.');
            console.log('');
            console.log('Run "n8n-wfm version init" to initialize.');
            return;
          }

          // 파일 경로 처리 (상대 경로)
          const filePath = file.startsWith('/') ? path.relative(repoPath, file) : file;
          const fullFilePath = path.join(repoPath, filePath);

          let oldWorkflow: Record<string, unknown> | null = null;
          let newWorkflow: Record<string, unknown> | null = null;
          let compareLabel = '';

          if (options.commits) {
            // 두 커밋 간 비교
            const [hash1, hash2] = options.commits.split(',').map((h) => h.trim());
            if (!hash1 || !hash2) {
              console.log('Error: --commits requires two hashes separated by comma');
              console.log('  Example: --commits abc123,def456');
              process.exitCode = 1;
              return;
            }

            oldWorkflow = await getWorkflowAtCommit(repoPath, filePath, hash1);
            newWorkflow = await getWorkflowAtCommit(repoPath, filePath, hash2);
            compareLabel = `${hash1.substring(0, 7)}..${hash2.substring(0, 7)}`;
          } else if (options.commit) {
            // 특정 커밋과 현재 파일 비교
            oldWorkflow = await getWorkflowAtCommit(repoPath, filePath, options.commit);
            newWorkflow = readWorkflowFile(fullFilePath);
            compareLabel = `${options.commit.substring(0, 7)}..working`;
          } else {
            // 기본: HEAD와 현재 파일 비교
            oldWorkflow = await getWorkflowAtCommit(repoPath, filePath, 'HEAD');
            newWorkflow = readWorkflowFile(fullFilePath);
            compareLabel = 'HEAD..working';
          }

          // 파일 존재 여부 확인
          if (!oldWorkflow && !newWorkflow) {
            console.log(`Error: File not found: ${filePath}`);
            console.log('  File does not exist in the specified commits or working directory.');
            process.exitCode = 1;
            return;
          }

          // 새 파일인 경우 (이전 버전 없음)
          if (!oldWorkflow) {
            console.log(`File: ${filePath}`);
            console.log(`Compare: ${compareLabel}`);
            console.log('');
            console.log('New file (no previous version)');
            return;
          }

          // 삭제된 파일인 경우 (현재 버전 없음)
          if (!newWorkflow) {
            console.log(`File: ${filePath}`);
            console.log(`Compare: ${compareLabel}`);
            console.log('');
            console.log('File deleted (no current version)');
            return;
          }

          // 워크플로우 비교
          const diff = compareWorkflows(oldWorkflow, newWorkflow);

          // 출력 형식 선택
          if (options.json) {
            console.log(formatDiffAsJson(diff));
          } else if (options.summary) {
            // 요약만 출력
            console.log(`File: ${filePath}`);
            console.log(`Compare: ${compareLabel}`);
            console.log('');
            console.log(`Workflow: ${diff.workflowName}`);
            console.log('');
            const { summary } = diff;
            const total =
              summary.nodesAdded +
              summary.nodesRemoved +
              summary.nodesModified +
              summary.connectionsAdded +
              summary.connectionsRemoved +
              (diff.settingsChanged ? 1 : 0);

            if (total === 0) {
              console.log('No changes detected.');
            } else {
              console.log(`Changes: ${total} total`);
              if (summary.nodesAdded > 0) console.log(`  Nodes added: ${summary.nodesAdded}`);
              if (summary.nodesRemoved > 0) console.log(`  Nodes removed: ${summary.nodesRemoved}`);
              if (summary.nodesModified > 0)
                console.log(`  Nodes modified: ${summary.nodesModified}`);
              if (summary.connectionsAdded > 0)
                console.log(`  Connections added: ${summary.connectionsAdded}`);
              if (summary.connectionsRemoved > 0)
                console.log(`  Connections removed: ${summary.connectionsRemoved}`);
              if (diff.settingsChanged) console.log('  Settings changed: yes');
            }
          } else {
            // 전체 출력
            console.log(`File: ${filePath}`);
            console.log(`Compare: ${compareLabel}`);
            console.log('');
            console.log(formatDiff(diff, { verbose: options.verbose }));
          }
        } catch (error) {
          if (error instanceof GitError) {
            console.log(`Error: ${error.message}`);
            console.log(`  Operation: ${error.operation}`);
          } else {
            const message = error instanceof Error ? error.message : String(error);
            console.log(`Error: ${message}`);
          }
          process.exitCode = 1;
        }
      }
    );
}
