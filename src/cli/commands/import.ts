/**
 * import 명령어 모듈
 * @description JSON 파일에서 워크플로우를 n8n 인스턴스로 가져오는 명령어
 */

import * as fs from 'fs';
import * as path from 'path';
import type { Command } from 'commander';
import { loadConfig, getEnvironment, getCurrentEnvironment, configExists, findConfigPath } from '../../config/index.js';
import { createClient } from '../../api/index.js';
import {
  importWorkflow,
  importAllWorkflows,
  type ImportOptions,
  type ImportResult,
} from '../../workflow/index.js';

/**
 * 가져오기 결과 출력
 * @param result - 가져오기 결과
 */
function printImportResult(result: ImportResult): void {
  if (result.success) {
    const actionText =
      result.action === 'created'
        ? 'Created'
        : result.action === 'updated'
          ? 'Updated'
          : 'Skipped';

    console.log(`✓ ${actionText}: ${result.workflowName}`);
    console.log(`  ID: ${result.workflowId}`);
  } else {
    console.log(`✗ Failed: ${result.workflowName || 'Unknown'}`);
    if (result.error) {
      console.log(`  Error: ${result.error}`);
    }
  }
}

/**
 * 설정 파일 없음 안내 출력
 */
function printNoConfigMessage(): void {
  console.log('✗ Configuration not found');
  console.log('');
  console.log('No configuration file found.');
  console.log('');
  console.log('To get started:');
  console.log('  1. Copy config.example.yaml to n8n-wfm.config.yaml');
  console.log('  2. Edit the file with your n8n instance details');
  console.log('  3. Set environment variables for API keys');
  console.log('');
  console.log('Or use: n8n-wfm config init');
}

/**
 * import 명령어 등록
 * @param program - Commander 프로그램 인스턴스
 */
export function registerImportCommand(program: Command): void {
  program
    .command('import <file>')
    .description('JSON 파일에서 워크플로우 가져오기')
    .option('-e, --env <name>', '환경 지정')
    .option('-c, --config <path>', '설정 파일 경로 지정')
    .option('-m, --mode <mode>', '가져오기 모드 (create/update/upsert)', 'create')
    .option('--activate', '가져온 후 활성화', false)
    .action(
      async (
        file: string,
        options: {
          env?: string;
          config?: string;
          mode?: string;
          activate?: boolean;
        }
      ) => {
        // 파일 경로 해석 (상대 경로를 절대 경로로)
        const filePath = path.resolve(file);

        // 파일 존재 확인
        if (!fs.existsSync(filePath)) {
          console.log('✗ Error');
          console.log('');
          console.log(`  File not found: ${filePath}`);
          process.exitCode = 1;
          return;
        }

        // 설정 파일 존재 확인
        if (!configExists(options.config)) {
          printNoConfigMessage();
          process.exitCode = 1;
          return;
        }

        // 모드 검증
        const validModes = ['create', 'update', 'upsert'];
        const mode = options.mode || 'create';
        if (!validModes.includes(mode)) {
          console.log('✗ Error');
          console.log('');
          console.log(`  Invalid mode: ${mode}`);
          console.log(`  Valid modes: ${validModes.join(', ')}`);
          process.exitCode = 1;
          return;
        }

        const configPath = findConfigPath(options.config);
        console.log(`Using config: ${configPath}`);
        console.log('');

        try {
          // 설정 로드
          const config = loadConfig(options.config);

          // 환경 설정 가져오기
          const envConfig = options.env
            ? getEnvironment(config, options.env)
            : getCurrentEnvironment(config);

          console.log(`Environment: ${envConfig.name}`);
          console.log(`URL: ${envConfig.n8n.url}`);
          console.log('');

          // API 클라이언트 생성
          const client = createClient(envConfig);

          // 가져오기 옵션 설정
          const importOptions: Partial<ImportOptions> = {
            mode: mode as ImportOptions['mode'],
            activate: options.activate || false,
          };

          console.log(`Importing from: ${filePath}`);
          console.log(`Mode: ${mode}`);
          if (options.activate) {
            console.log('Activate after import: Yes');
          }
          console.log('');

          // 워크플로우 가져오기
          const result = await importWorkflow(client, filePath, importOptions);

          // 결과 출력
          printImportResult(result);

          if (!result.success) {
            process.exitCode = 1;
          }
        } catch (error) {
          console.log('\u2717 Error');
          console.log('');
          const message = error instanceof Error ? error.message : String(error);
          console.log(`  ${message}`);
          process.exitCode = 1;
        }
      }
    );
}

/**
 * import-all 명령어 등록
 * @param program - Commander 프로그램 인스턴스
 */
export function registerImportAllCommand(program: Command): void {
  program
    .command('import-all <directory>')
    .description('디렉토리의 모든 JSON 파일에서 워크플로우 가져오기')
    .option('-e, --env <name>', '환경 지정')
    .option('-c, --config <path>', '설정 파일 경로 지정')
    .option('-m, --mode <mode>', '가져오기 모드 (create/update/upsert)', 'create')
    .option('--activate', '가져온 후 활성화', false)
    .option('--stop-on-error', '에러 발생 시 중단', false)
    .action(
      async (
        directory: string,
        options: {
          env?: string;
          config?: string;
          mode?: string;
          activate?: boolean;
          stopOnError?: boolean;
        }
      ) => {
        // 디렉토리 경로 해석 (상대 경로를 절대 경로로)
        const dirPath = path.resolve(directory);

        // 디렉토리 존재 확인
        if (!fs.existsSync(dirPath)) {
          console.log('\u2717 Error');
          console.log('');
          console.log(`  Directory not found: ${dirPath}`);
          process.exitCode = 1;
          return;
        }

        // 디렉토리인지 확인
        const stat = fs.statSync(dirPath);
        if (!stat.isDirectory()) {
          console.log('\u2717 Error');
          console.log('');
          console.log(`  Not a directory: ${dirPath}`);
          process.exitCode = 1;
          return;
        }

        // 설정 파일 존재 확인
        if (!configExists(options.config)) {
          printNoConfigMessage();
          process.exitCode = 1;
          return;
        }

        // 모드 검증
        const validModes = ['create', 'update', 'upsert'];
        const mode = options.mode || 'create';
        if (!validModes.includes(mode)) {
          console.log('\u2717 Error');
          console.log('');
          console.log(`  Invalid mode: ${mode}`);
          console.log(`  Valid modes: ${validModes.join(', ')}`);
          process.exitCode = 1;
          return;
        }

        const configPath = findConfigPath(options.config);
        console.log(`Using config: ${configPath}`);
        console.log('');

        try {
          // 설정 로드
          const config = loadConfig(options.config);

          // 환경 설정 가져오기
          const envConfig = options.env
            ? getEnvironment(config, options.env)
            : getCurrentEnvironment(config);

          console.log(`Environment: ${envConfig.name}`);
          console.log(`URL: ${envConfig.n8n.url}`);
          console.log(`Mode: ${mode}`);
          if (options.activate) {
            console.log('Activate after import: Yes');
          }
          if (options.stopOnError) {
            console.log('Stop on error: Yes');
          }
          console.log('');
          console.log(`Importing workflows from ${dirPath}...`);

          // API 클라이언트 생성
          const client = createClient(envConfig);

          // 벌크 가져오기 실행
          const result = await importAllWorkflows(
            client,
            dirPath,
            {
              mode: mode as ImportOptions['mode'],
              activate: options.activate || false,
              continueOnError: !options.stopOnError,
            },
            // 진행 상황 콜백
            (current, total, name, success, error) => {
              if (success) {
                console.log(`\u2713 ${name} (${current}/${total})`);
              } else {
                console.log(`\u2717 ${name} (${current}/${total}) - ${error}`);
              }
            }
          );

          // 최종 결과 출력
          console.log('');
          console.log(`Import complete: ${result.succeeded} succeeded, ${result.failed} failed`);

          if (result.failed > 0) {
            process.exitCode = 1;
          }
        } catch (error) {
          console.log('\u2717 Error');
          console.log('');
          const message = error instanceof Error ? error.message : String(error);
          console.log(`  ${message}`);
          process.exitCode = 1;
        }
      }
    );
}
