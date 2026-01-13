/**
 * status 명령어 모듈
 * @description n8n 인스턴스 연결 상태를 확인하는 명령어
 */

import type { Command } from 'commander';
import { connectToEnvironment, type ConnectionTestResult } from '../../api/index.js';
import { configExists, findConfigPath } from '../../config/index.js';

/**
 * 연결 상태 출력
 * @param result - 연결 테스트 결과
 */
function printConnectionStatus(result: ConnectionTestResult): void {
  const { status } = result;

  if (status.connected) {
    console.log('✓ Connected to n8n');
    console.log('');
    console.log(`  Environment: ${status.environment}`);
    console.log(`  URL: ${status.url}`);
    if (status.latencyMs !== undefined) {
      console.log(`  Latency: ${status.latencyMs}ms`);
    }
  } else {
    console.log('✗ Connection failed');
    console.log('');
    console.log(`  Environment: ${status.environment}`);
    console.log(`  URL: ${status.url}`);
    if (status.error) {
      console.log(`  Error: ${status.error}`);
    }
    console.log('');
    console.log('Troubleshooting:');
    console.log('  1. Check if n8n is running');
    console.log('  2. Verify the URL in config');
    console.log('  3. Check your API key');
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
 * status 명령어 등록
 * @param program - Commander 프로그램 인스턴스
 */
export function registerStatusCommand(program: Command): void {
  program
    .command('status')
    .description('n8n 인스턴스 연결 상태 확인')
    .option('-e, --env <name>', '특정 환경 지정')
    .option('-c, --config <path>', '설정 파일 경로 지정')
    .action(async (options: { env?: string; config?: string }) => {
      // 설정 파일 존재 확인
      if (!configExists(options.config)) {
        printNoConfigMessage();
        process.exitCode = 1;
        return;
      }

      const configPath = findConfigPath(options.config);
      console.log(`Using config: ${configPath}`);
      console.log('');

      try {
        // 연결 테스트
        const result = await connectToEnvironment(options.env, options.config);
        printConnectionStatus(result);

        if (!result.success) {
          process.exitCode = 1;
        }
      } catch (error) {
        console.log('✗ Error');
        console.log('');
        const message = error instanceof Error ? error.message : String(error);
        console.log(`  ${message}`);
        process.exitCode = 1;
      }
    });
}
