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
import {
  createBackup,
  createSelectiveBackup,
  cleanupOldBackups,
  formatBytes,
} from '../../backup/index.js';

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
 * 정리 결과 출력
 * @param deletedCount - 삭제된 백업 수
 * @param freedSpace - 해제된 용량
 * @param remainingCount - 남은 백업 수
 */
function printCleanupResult(
  deletedCount: number,
  freedSpace: number,
  remainingCount: number
): void {
  console.log('');
  console.log('Cleanup completed:');
  console.log(`  Deleted: ${deletedCount} backup(s)`);
  console.log(`  Freed: ${formatBytes(freedSpace)}`);
  console.log(`  Remaining: ${remainingCount} backup(s)`);
}

/**
 * cron 설정 예시 출력
 */
function printCronExamples(): void {
  console.log('n8n Workflow Backup - Cron Schedule Examples');
  console.log('');
  console.log('Add to crontab with: crontab -e');
  console.log('');
  console.log('=== Common Schedule Patterns ===');
  console.log('');
  console.log('# Every day at 2:00 AM (recommended)');
  console.log('0 2 * * * cd /path/to/project && n8n-wfm backup --cleanup >> /var/log/n8n-backup.log 2>&1');
  console.log('');
  console.log('# Every 6 hours');
  console.log('0 */6 * * * cd /path/to/project && n8n-wfm backup --cleanup >> /var/log/n8n-backup.log 2>&1');
  console.log('');
  console.log('# Every Monday at 3:00 AM');
  console.log('0 3 * * 1 cd /path/to/project && n8n-wfm backup --cleanup >> /var/log/n8n-backup.log 2>&1');
  console.log('');
  console.log('# Every hour');
  console.log('0 * * * * cd /path/to/project && n8n-wfm backup --retention 24 --cleanup >> /var/log/n8n-backup.log 2>&1');
  console.log('');
  console.log('=== Cron Format ===');
  console.log('');
  console.log('┌───────────── minute (0 - 59)');
  console.log('│ ┌─────────── hour (0 - 23)');
  console.log('│ │ ┌───────── day of month (1 - 31)');
  console.log('│ │ │ ┌─────── month (1 - 12)');
  console.log('│ │ │ │ ┌───── day of week (0 - 6) (Sunday=0)');
  console.log('│ │ │ │ │');
  console.log('* * * * * command');
  console.log('');
  console.log('=== Options ===');
  console.log('');
  console.log('--retention <count>  : Keep only the latest N backups (default: from config)');
  console.log('--cleanup            : Apply retention policy after backup');
  console.log('--active-only        : Backup active workflows only');
  console.log('');
  console.log('=== Log Rotation (Optional) ===');
  console.log('');
  console.log('Create /etc/logrotate.d/n8n-backup:');
  console.log('');
  console.log('/var/log/n8n-backup.log {');
  console.log('    weekly');
  console.log('    rotate 4');
  console.log('    compress');
  console.log('    missingok');
  console.log('    notifempty');
  console.log('}');
}

/**
 * backup 명령어 등록
 * @param program - Commander 프로그램 인스턴스
 */
export function registerBackupCommand(program: Command): void {
  const backupCmd = program
    .command('backup')
    .description('워크플로우 백업 생성')
    .option('-o, --output <dir>', '백업 저장 디렉토리', './backups')
    .option('-e, --env <name>', '환경 지정')
    .option('-c, --config <path>', '설정 파일 경로 지정')
    .option('--keep-credentials', 'credentials 유지 (기본: 제거)')
    .option('--active-only', '활성화된 워크플로우만 백업')
    .option('--ids <ids>', '특정 워크플로우 ID들만 백업 (콤마 구분)')
    .option('--description <text>', '백업 설명 메모')
    .option('--retention <count>', '보관할 백업 개수 (0이면 무제한)', parseInt)
    .option('--cleanup', '백업 후 보관 정책 적용 (오래된 백업 삭제)')
    .action(
      async (options: {
        output: string;
        env?: string;
        config?: string;
        keepCredentials?: boolean;
        activeOnly?: boolean;
        ids?: string;
        description?: string;
        retention?: number;
        cleanup?: boolean;
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

          // 보관 정책 적용 (--cleanup 옵션이 있을 때)
          if (options.cleanup) {
            // retention 값 결정: CLI 옵션 > 설정 파일 > 기본값(10)
            const retentionCount =
              options.retention ?? config.backup?.retention ?? 10;

            if (retentionCount > 0) {
              console.log('');
              console.log(`Applying retention policy (keep: ${retentionCount})...`);

              const cleanupResult = cleanupOldBackups(backupBaseDir, retentionCount);

              if (cleanupResult.deletedCount > 0) {
                printCleanupResult(
                  cleanupResult.deletedCount,
                  cleanupResult.freedSpace,
                  cleanupResult.remainingCount
                );
              } else {
                console.log('  No old backups to cleanup.');
              }
            } else {
              console.log('');
              console.log('Retention set to 0 (unlimited), skipping cleanup.');
            }
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

  // cron-example 하위 명령어 등록
  backupCmd
    .command('cron-example')
    .description('시스템 cron 스케줄 설정 예시 출력')
    .action(() => {
      printCronExamples();
    });
}
