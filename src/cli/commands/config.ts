/**
 * config 명령어 모듈
 * @description 설정 파일 관리 명령어
 */

import * as fs from 'fs';
import * as path from 'path';
import type { Command } from 'commander';
import { loadConfig, configExists, findConfigPath, type Config } from '../../config/index.js';

/**
 * API Key 마스킹 (앞 4자리만 표시)
 * @param apiKey - API Key
 * @returns 마스킹된 API Key
 */
function maskApiKey(apiKey: string): string {
  if (!apiKey || apiKey.length < 8) {
    return '****';
  }
  return `${apiKey.slice(0, 4)}${'*'.repeat(Math.min(apiKey.length - 4, 12))}`;
}

/**
 * 설정 내용 출력
 * @param config - 설정 객체
 * @param configPath - 설정 파일 경로
 */
function printConfigShow(config: Config, configPath: string): void {
  console.log('Configuration');
  console.log('─────────────');
  console.log(`File: ${configPath}`);
  console.log(`Version: ${config.version}`);
  console.log(`Current Environment: ${config.currentEnvironment}`);
  console.log('');
  console.log('Environments:');

  for (const env of config.environments) {
    const isCurrent = env.name === config.currentEnvironment;
    const marker = isCurrent ? '(current)' : '';
    console.log(`  • ${env.name} ${marker}`);
    console.log(`    URL: ${env.n8n.url}`);
    console.log(`    API Key: ${maskApiKey(env.n8n.apiKey)}`);
  }

  if (config.backup) {
    console.log('');
    console.log('Backup:');
    console.log(`  Directory: ${config.backup.directory}`);
    console.log(`  Retention: ${config.backup.retention} days`);
  }
}

/**
 * 설정 파일 검색 경로 출력
 */
function printConfigPath(): void {
  const searchPaths = [
    './n8n-wfm.config.yaml',
    './n8n-wfm.config.yml',
    '~/.n8n-wfm/config.yaml',
    '~/.n8n-wfm/config.yml',
  ];

  console.log('Configuration Search Paths');
  console.log('──────────────────────────');
  console.log('');
  console.log('Search order:');
  searchPaths.forEach((p, i) => {
    console.log(`  ${i + 1}. ${p}`);
  });

  console.log('');

  const foundPath = findConfigPath();
  if (foundPath) {
    console.log(`Currently using: ${foundPath}`);
  } else {
    console.log('No configuration file found.');
  }
}

/**
 * 설정 파일 초기화
 * @param force - 강제 덮어쓰기 여부
 */
function initConfig(force: boolean): void {
  const examplePath = './config.example.yaml';
  const targetPath = './n8n-wfm.config.yaml';

  // 예제 파일 존재 확인
  if (!fs.existsSync(examplePath)) {
    console.log('✗ Error: config.example.yaml not found');
    console.log('');
    console.log('Make sure you are in the project root directory.');
    process.exitCode = 1;
    return;
  }

  // 대상 파일 존재 확인
  if (fs.existsSync(targetPath) && !force) {
    console.log(`✗ Configuration file already exists: ${targetPath}`);
    console.log('');
    console.log('Use --force to overwrite.');
    process.exitCode = 1;
    return;
  }

  try {
    // 파일 복사
    fs.copyFileSync(examplePath, targetPath);
    console.log(`✓ Created: ${targetPath}`);
    console.log('');
    console.log('Next steps:');
    console.log('  1. Edit n8n-wfm.config.yaml with your settings');
    console.log('  2. Set environment variables for API keys:');
    console.log('     export N8N_DEV_API_KEY=your-api-key');
    console.log('  3. Run "n8n-wfm status" to test connection');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`✗ Error: ${message}`);
    process.exitCode = 1;
  }
}

/**
 * config 명령어 등록
 * @param program - Commander 프로그램 인스턴스
 */
export function registerConfigCommand(program: Command): void {
  const configCmd = program
    .command('config')
    .description('설정 관리');

  // config show
  configCmd
    .command('show')
    .description('현재 설정 내용 표시')
    .option('-c, --config <path>', '설정 파일 경로 지정')
    .action((options: { config?: string }) => {
      if (!configExists(options.config)) {
        console.log('✗ Configuration not found');
        console.log('');
        console.log('Use "n8n-wfm config init" to create a configuration file.');
        process.exitCode = 1;
        return;
      }

      try {
        const configPath = findConfigPath(options.config);
        const config = loadConfig(options.config);
        printConfigShow(config, configPath!);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.log(`✗ Error: ${message}`);
        process.exitCode = 1;
      }
    });

  // config path
  configCmd
    .command('path')
    .description('설정 파일 검색 경로 표시')
    .action(() => {
      printConfigPath();
    });

  // config init
  configCmd
    .command('init')
    .description('설정 파일 초기화')
    .option('-f, --force', '기존 파일 덮어쓰기')
    .action((options: { force?: boolean }) => {
      initConfig(options.force ?? false);
    });
}
