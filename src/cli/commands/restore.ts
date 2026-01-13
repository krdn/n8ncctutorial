/**
 * restore 명령어 모듈
 * @description 백업된 워크플로우를 복원하는 CLI 명령어
 */

import type { Command } from 'commander';
import {
  loadConfig,
  configExists,
  findConfigPath,
} from '../../config/index.js';
import {
  getBackupList,
  getBackupDetail,
  formatBackupList,
  formatBackupDetailString,
  formatBackupDetail,
} from '../../restore/index.js';

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

  // 향후 추가될 하위 명령어 플레이스홀더
  // - restore run <backupId>: 실제 복원 실행 (05-02에서 구현)
  // - restore diff <backupId>: 현재 상태와 백업 비교 (05-03에서 구현)
}
