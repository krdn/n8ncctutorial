/**
 * export 명령어 모듈
 * @description 워크플로우를 JSON 파일로 내보내는 명령어
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
import { exportWorkflow, bulkExportWorkflows } from '../../workflow/index.js';
import type { N8nWorkflow } from '../../types/n8n.js';

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
 * 내보내기 성공 결과 출력
 * @param workflowName - 워크플로우 이름
 * @param filePath - 저장된 파일 경로
 */
function printSuccess(workflowName: string, filePath: string): void {
  console.log(`Exported: ${workflowName}`);
  console.log(`  File: ${filePath}`);
}

/**
 * 내보내기 실패 결과 출력
 * @param workflowId - 워크플로우 ID
 * @param error - 에러 메시지
 */
function printError(workflowId: string, error: string): void {
  console.log(`Error: Failed to export workflow ${workflowId}`);
  console.log(`  ${error}`);
}

/**
 * export 명령어 등록
 * @param program - Commander 프로그램 인스턴스
 */
export function registerExportCommand(program: Command): void {
  program
    .command('export <workflow-id>')
    .description('워크플로우를 JSON 파일로 내보내기')
    .option('-o, --output <dir>', '출력 디렉토리', './exports')
    .option('-e, --env <name>', '환경 지정')
    .option('-c, --config <path>', '설정 파일 경로 지정')
    .option('--keep-credentials', 'credentials 유지 (기본: 제거)')
    .action(
      async (
        workflowId: string,
        options: {
          output: string;
          env?: string;
          config?: string;
          keepCredentials?: boolean;
        }
      ) => {
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

          console.log(`Environment: ${envConfig.name}`);
          console.log('');

          // API 클라이언트 생성
          const client = createClient(envConfig);

          // 워크플로우 내보내기
          const result = await exportWorkflow(client, workflowId, {
            outputDir: options.output,
            stripCredentials: !options.keepCredentials,
            prettyPrint: true,
          });

          // 결과 출력
          if (result.success) {
            printSuccess(result.workflowName, result.filePath);
          } else {
            printError(result.workflowId, result.error || 'Unknown error');
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

/**
 * export-all 명령어 등록
 * @param program - Commander 프로그램 인스턴스
 */
export function registerExportAllCommand(program: Command): void {
  program
    .command('export-all')
    .description('모든 워크플로우를 JSON 파일로 내보내기')
    .option('-o, --output <dir>', '출력 디렉토리', './exports')
    .option('-e, --env <name>', '환경 지정')
    .option('-c, --config <path>', '설정 파일 경로 지정')
    .option('--keep-credentials', 'credentials 유지 (기본: 제거)')
    .option('--active-only', '활성화된 워크플로우만 내보내기')
    .action(
      async (options: {
        output: string;
        env?: string;
        config?: string;
        keepCredentials?: boolean;
        activeOnly?: boolean;
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

          console.log(`Environment: ${envConfig.name}`);
          console.log(`Output: ${options.output}`);
          if (options.activeOnly) {
            console.log('Filter: Active workflows only');
          }
          console.log('');
          console.log('Exporting workflows...');

          // API 클라이언트 생성
          const client = createClient(envConfig);

          // 필터 함수 생성
          const filter = options.activeOnly
            ? (workflow: N8nWorkflow) => workflow.active === true
            : undefined;

          // 벌크 내보내기 실행
          const result = await bulkExportWorkflows(
            client,
            {
              outputDir: options.output,
              stripCredentials: !options.keepCredentials,
              prettyPrint: true,
              filter,
            },
            // 진행 상황 콜백
            (current, total, name, success, error) => {
              const status = success ? '\u2713' : '\u2717';
              if (success) {
                console.log(`${status} ${name} (${current}/${total})`);
              } else {
                console.log(`${status} ${name} (${current}/${total}) - ${error}`);
              }
            }
          );

          // 최종 결과 출력
          console.log('');
          console.log(`Export complete: ${result.succeeded} succeeded, ${result.failed} failed`);
          console.log(`Output: ${options.output}`);

          if (result.failed > 0) {
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
