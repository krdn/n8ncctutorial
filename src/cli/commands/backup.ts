/**
 * backup 명령어 모듈
 * @description 워크플로우를 백업하는 CLI 명령어
 */

import type { Command } from 'commander';
import { createClient } from '../../api/index.js';
import {
  loadConfig,
  getCurrentEnvironment,
  getEnvironment,
  configExists,
  findConfigPath,
} from '../../config/index.js';
import { createBackup, createSelectiveBackup } from '../../backup/index.js';

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
 * 백업 성공 결과 출력
 * @param backupId - 백업 ID
 * @param backupPath - 백업 경로
 * @param successCount - 성공 개수
 * @param failedCount - 실패 개수
 * @param duration - 소요 시간 (ms)
 */
function printSuccess(
  backupId: string,
  backupPath: string,
  successCount: number,
  failedCount: number,
  duration: number
): void {
  console.log('');
  console.log('Backup complete!');
  console.log(`  ID: ${backupId}`);
  console.log(`  Path: ${backupPath}`);
  console.log(`  Workflows: ${successCount} succeeded, ${failedCount} failed`);
  console.log(`  Duration: ${(duration / 1000).toFixed(2)}s`);
}

/**
 * 백업 실패 결과 출력
 * @param error - 에러 메시지
 */
function printError(error: string): void {
  console.log('Error: Backup failed');
  console.log(`  ${error}`);
}

/**
 * backup 명령어 등록
 * @param program - Commander 프로그램 인스턴스
 */
export function registerBackupCommand(program: Command): void {
  program
    .command('backup')
    .description('워크플로우 백업 생성')
    .option('-o, --output <dir>', '백업 저장 디렉토리', './backups')
    .option('-e, --env <name>', '환경 지정')
    .option('-c, --config <path>', '설정 파일 경로 지정')
    .option('--keep-credentials', 'credentials 유지 (기본: 제거)')
    .option('--active-only', '활성화된 워크플로우만 백업')
    .option('--ids <ids>', '특정 워크플로우 ID들만 백업 (콤마 구분)')
    .option('--description <text>', '백업 설명 메모')
    .action(
      async (options: {
        output: string;
        env?: string;
        config?: string;
        keepCredentials?: boolean;
        activeOnly?: boolean;
        ids?: string;
        description?: string;
      }) => {
        // 설정 파일 존재 확인
        if (!configExists(options.config)) {
          printNoConfigMessage();
          process.exitCode = 1;
          return;
        }

        const configPath = findConfigPath(options.config);
        if (configPath) {
          console.log(`Using config: ${configPath}`);
        }

        try {
          // 설정 로드
          const config = loadConfig(options.config);

          // 환경 선택
          const envConfig = options.env
            ? getEnvironment(config, options.env)
            : getCurrentEnvironment(config);

          // 백업 기본 디렉토리 결정 (설정 파일 우선, 없으면 CLI 옵션)
          const backupBaseDir = config.backup?.baseDir || options.output;

          console.log(`Environment: ${envConfig.name}`);
          console.log(`Backup directory: ${backupBaseDir}`);

          if (options.activeOnly) {
            console.log('Filter: Active workflows only');
          }
          if (options.ids) {
            console.log(`Filter: Specific IDs (${options.ids})`);
          }
          console.log('');
          console.log('Creating backup...');

          // API 클라이언트 생성
          const client = createClient(envConfig);

          // 백업 옵션 구성
          const backupOptions = {
            baseDir: backupBaseDir,
            stripCredentials: !options.keepCredentials,
            prettyPrint: true,
            description: options.description,
            environment: envConfig.name,
            n8nUrl: envConfig.n8n.url,
            activeOnly: options.activeOnly,
          };

          // 백업 실행
          let result;

          if (options.ids) {
            // 선택적 백업 (특정 ID들만)
            const workflowIds = options.ids.split(',').map((id) => id.trim());
            result = await createSelectiveBackup(
              client,
              workflowIds,
              backupOptions,
              // 진행 상황 콜백
              (current, total, name, success, error) => {
                const status = success ? '\u2713' : '\u2717';
                if (success) {
                  console.log(`  ${status} ${name} (${current}/${total})`);
                } else {
                  console.log(`  ${status} ${name} (${current}/${total}) - ${error}`);
                }
              }
            );
          } else {
            // 전체 백업 (또는 activeOnly 필터)
            result = await createBackup(
              client,
              backupOptions,
              // 진행 상황 콜백
              (current, total, name, success, error) => {
                const status = success ? '\u2713' : '\u2717';
                if (success) {
                  console.log(`  ${status} ${name} (${current}/${total})`);
                } else {
                  console.log(`  ${status} ${name} (${current}/${total}) - ${error}`);
                }
              }
            );
          }

          // 결과 출력
          if (result.success) {
            printSuccess(
              result.backupId,
              result.backupPath,
              result.successCount,
              result.failedCount,
              result.duration
            );
          } else if (result.error) {
            // 전체 실패
            printError(result.error);
            process.exitCode = 1;
          } else {
            // 부분 실패
            printSuccess(
              result.backupId,
              result.backupPath,
              result.successCount,
              result.failedCount,
              result.duration
            );
            console.log('');
            console.log('Warning: Some workflows failed to backup:');
            result.failedWorkflows.forEach((id) => {
              console.log(`  - ${id}`);
            });
            process.exitCode = 1;
          }
        } catch (error) {
          console.log('Error');
          console.log('');
          const message = error instanceof Error ? error.message : String(error);
          console.log(`  ${message}`);
          process.exitCode = 1;
        }
      }
    );
}
