/**
 * restore 명령어 모듈
 * @description 백업된 워크플로우를 복원하는 CLI 명령어
 */

import type { Command } from 'commander';
import {
  loadConfig,
  configExists,
  findConfigPath,
  getCurrentEnvironment,
  getEnvironment,
} from '../../config/index.js';
import { createClient } from '../../api/index.js';
import {
  getBackupList,
  getBackupDetail,
  formatBackupList,
  formatBackupDetailString,
  formatBackupDetail,
  restoreBackup,
  previewRestore,
  findBackupPath,
} from '../../restore/index.js';
import type { RestoreMode, RestoreWorkflowResult } from '../../restore/index.js';

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
 * 백업 기본 디렉토리 결정
 * @description CLI 옵션 또는 설정 파일에서 백업 디렉토리 가져오기
 * @param optionDir - CLI --dir 옵션 값
 * @param configPath - 설정 파일 경로
 * @returns 백업 기본 디렉토리
 */
function resolveBackupDir(optionDir?: string, configPath?: string): string {
  // CLI 옵션이 있으면 우선 사용
  if (optionDir) {
    return optionDir;
  }

  // 설정 파일에서 읽기 시도
  if (configExists(configPath)) {
    try {
      const config = loadConfig(configPath);
      if (config.backup?.baseDir) {
        return config.backup.baseDir;
      }
    } catch {
      // 설정 로드 실패 시 기본값 사용
    }
  }

  // 기본값
  return './backups';
}

/**
 * restore 명령어 등록
 * @param program - Commander 프로그램 인스턴스
 */
export function registerRestoreCommand(program: Command): void {
  const restoreCmd = program
    .command('restore')
    .description('백업된 워크플로우 복원');

  // restore list 하위 명령어
  restoreCmd
    .command('list')
    .description('백업 목록 조회')
    .option('-d, --dir <path>', '백업 디렉토리 지정')
    .option('-c, --config <path>', '설정 파일 경로 지정')
    .option('-l, --limit <n>', '출력할 최대 개수', parseInt)
    .option('--json', 'JSON 형식으로 출력')
    .action(
      async (options: {
        dir?: string;
        config?: string;
        limit?: number;
        json?: boolean;
      }) => {
        try {
          const backupDir = resolveBackupDir(options.dir, options.config);

          if (!options.json) {
            const configPath = findConfigPath(options.config);
            if (configPath) {
              console.log(`Using config: ${configPath}`);
            }
            console.log(`Backup directory: ${backupDir}`);
          }

          // 백업 목록 조회
          let backups = getBackupList(backupDir);

          // limit 적용
          if (options.limit && options.limit > 0) {
            backups = backups.slice(0, options.limit);
          }

          // 출력
          if (options.json) {
            console.log(JSON.stringify(backups, null, 2));
          } else {
            console.log(formatBackupList(backups));
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);

          if (options.json) {
            console.log(JSON.stringify({ error: message }));
          } else {
            console.log('Error:', message);
          }

          process.exitCode = 1;
        }
      }
    );

  // restore show 하위 명령어
  restoreCmd
    .command('show <backupId>')
    .description('특정 백업의 상세 정보 조회')
    .option('-d, --dir <path>', '백업 디렉토리 지정')
    .option('-c, --config <path>', '설정 파일 경로 지정')
    .option('--json', 'JSON 형식으로 출력')
    .action(
      async (
        backupId: string,
        options: {
          dir?: string;
          config?: string;
          json?: boolean;
        }
      ) => {
        try {
          const backupDir = resolveBackupDir(options.dir, options.config);

          if (!options.json) {
            const configPath = findConfigPath(options.config);
            if (configPath) {
              console.log(`Using config: ${configPath}`);
            }
            console.log(`Backup directory: ${backupDir}`);
          }

          // 백업 상세 정보 조회
          const manifest = getBackupDetail(backupDir, backupId);

          // 출력
          if (options.json) {
            console.log(JSON.stringify(formatBackupDetail(manifest), null, 2));
          } else {
            console.log(formatBackupDetailString(manifest));
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);

          if (options.json) {
            console.log(JSON.stringify({ error: message }));
          } else {
            console.log('Error:', message);
          }

          process.exitCode = 1;
        }
      }
    );

  // restore run 하위 명령어
  restoreCmd
    .command('run <backupId>')
    .description('백업에서 워크플로우 복원 실행')
    .option('-e, --env <name>', '복원 대상 환경 지정')
    .option('-c, --config <path>', '설정 파일 경로 지정')
    .option('-d, --dir <path>', '백업 디렉토리 지정')
    .option('--mode <mode>', '가져오기 모드 (skip/overwrite)', 'overwrite')
    .option('--activate', '복원 후 워크플로우 활성화')
    .option('--dry-run', '실제 복원 없이 계획만 표시')
    .option('--json', 'JSON 형식으로 출력')
    .action(
      async (
        backupId: string,
        options: {
          env?: string;
          config?: string;
          dir?: string;
          mode?: string;
          activate?: boolean;
          dryRun?: boolean;
          json?: boolean;
        }
      ) => {
        try {
          // 설정 확인
          if (!configExists(options.config)) {
            if (options.json) {
              console.log(JSON.stringify({ error: 'Configuration not found' }));
            } else {
              printNoConfigMessage();
            }
            process.exitCode = 1;
            return;
          }

          const config = loadConfig(options.config);
          const backupDir = resolveBackupDir(options.dir, options.config);

          // 백업 경로 찾기
          let backupPath: string;
          try {
            backupPath = findBackupPath(backupDir, backupId);
          } catch {
            if (options.json) {
              console.log(JSON.stringify({ error: `백업을 찾을 수 없습니다: ${backupId}` }));
            } else {
              console.log(`Error: 백업을 찾을 수 없습니다: ${backupId}`);
            }
            process.exitCode = 1;
            return;
          }

          // dry-run 모드: 복원 계획만 표시
          if (options.dryRun) {
            const preview = previewRestore(backupPath);

            if (options.json) {
              console.log(JSON.stringify(preview, null, 2));
            } else {
              console.log('');
              console.log('Restore Plan (dry-run)');
              console.log('='.repeat(60));
              console.log(`  Backup ID:    ${preview.backupId}`);
              console.log(`  Environment:  ${preview.environment}`);
              console.log(`  n8n URL:      ${preview.n8nUrl}`);
              console.log(`  Workflows:    ${preview.totalCount}`);
              console.log('');
              console.log('Workflows to restore:');
              console.log('-'.repeat(60));
              for (const wf of preview.workflows) {
                const activeStr = wf.active ? '[active]' : '[inactive]';
                console.log(`  ${wf.id.padEnd(8)} ${wf.name.slice(0, 40).padEnd(42)} ${activeStr}`);
              }
              console.log('-'.repeat(60));
              console.log('');
              console.log('Use without --dry-run to execute restore.');
            }
            return;
          }

          // 환경 결정
          let envConfig;
          let envName: string;
          try {
            if (options.env) {
              envConfig = getEnvironment(config, options.env);
              envName = options.env;
            } else {
              envConfig = getCurrentEnvironment(config);
              envName = envConfig.name;
            }
          } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            if (options.json) {
              console.log(JSON.stringify({ error: msg }));
            } else {
              console.log(`Error: ${msg}`);
            }
            process.exitCode = 1;
            return;
          }

          if (!options.json) {
            const configPath = findConfigPath(options.config);
            if (configPath) {
              console.log(`Using config: ${configPath}`);
            }
            console.log(`Environment: ${envName}`);
            console.log(`Backup: ${backupId}`);
            console.log('');
          }

          // API 클라이언트 생성
          const client = createClient(envConfig);

          // 복원 모드 검증
          const validModes = ['skip', 'overwrite', 'rename'];
          const restoreMode: RestoreMode = validModes.includes(options.mode || '')
            ? (options.mode as RestoreMode)
            : 'overwrite';

          // 진행 상황 출력 콜백
          const onProgress = options.json
            ? undefined
            : (current: number, total: number, result: RestoreWorkflowResult) => {
                const symbol = result.success
                  ? result.action === 'skipped'
                    ? '-'
                    : '+'
                  : 'x';
                const action = result.action || 'failed';
                console.log(`  [${current}/${total}] ${symbol} ${result.name} (${action})`);
              };

          // 복원 실행
          if (!options.json) {
            console.log('Restoring workflows...');
          }

          const result = await restoreBackup(client, backupPath, {
            mode: restoreMode,
            activate: options.activate || false,
          }, onProgress);

          // 결과 출력
          if (options.json) {
            console.log(JSON.stringify(result, null, 2));
          } else {
            console.log('');
            console.log('='.repeat(60));
            console.log(result.success ? 'Restore completed!' : 'Restore completed with errors');
            console.log(`  Total:    ${result.totalCount}`);
            console.log(`  Success:  ${result.successCount}`);
            console.log(`  Skipped:  ${result.skippedCount}`);
            console.log(`  Failed:   ${result.failedCount}`);
            console.log(`  Duration: ${(result.duration / 1000).toFixed(2)}s`);

            if (result.failedCount > 0) {
              console.log('');
              console.log('Failed workflows:');
              for (const wf of result.workflows) {
                if (!wf.success) {
                  console.log(`  - ${wf.name}: ${wf.error}`);
                }
              }
            }

            if (result.successCount > 0) {
              console.log('');
              console.log('Note: Credentials were stripped during backup.');
              console.log('      Please configure credentials manually in n8n.');
            }
          }

          if (!result.success) {
            process.exitCode = 1;
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);

          if (options.json) {
            console.log(JSON.stringify({ error: message }));
          } else {
            console.log('Error:', message);
          }

          process.exitCode = 1;
        }
      }
    );

  // 향후 추가될 하위 명령어 플레이스홀더
  // - restore diff <backupId>: 현재 상태와 백업 비교 (05-03에서 구현)
}
