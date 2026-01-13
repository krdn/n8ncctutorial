/**
 * env 명령어 모듈
 * @description 환경 관리 명령어 (list, current, use)
 */

import type { Command } from 'commander';
import {
  loadConfig,
  configExists,
  findConfigPath,
  listEnvironments,
  getCurrentEnvironment,
} from '../../config/index.js';
import { switchEnvironment } from '../../config/switch.js';

/**
 * 환경 목록 출력 (env list)
 * @param configPath - 설정 파일 경로 (선택)
 */
function printEnvironmentList(configPath?: string): void {
  if (!configExists(configPath)) {
    console.log('✗ 설정 파일을 찾을 수 없습니다.');
    console.log('');
    console.log('"n8n-wfm config init" 명령어로 설정 파일을 생성하세요.');
    process.exitCode = 1;
    return;
  }

  try {
    const config = loadConfig(configPath);
    const environments = listEnvironments(config);

    console.log('Environments');
    console.log('────────────');
    console.log('');

    for (const env of environments) {
      const marker = env.isCurrent ? ' (current)' : '';
      const defaultMarker = env.isDefault ? ' [default]' : '';
      const prefix = env.isCurrent ? '* ' : '  ';

      console.log(`${prefix}${env.name}${marker}${defaultMarker}`);
      console.log(`    URL: ${env.url}`);
      if (env.description) {
        console.log(`    Description: ${env.description}`);
      }
      console.log('');
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`✗ 오류: ${message}`);
    process.exitCode = 1;
  }
}

/**
 * 현재 환경 출력 (env current)
 * @param configPath - 설정 파일 경로 (선택)
 */
function printCurrentEnvironment(configPath?: string): void {
  if (!configExists(configPath)) {
    console.log('✗ 설정 파일을 찾을 수 없습니다.');
    console.log('');
    console.log('"n8n-wfm config init" 명령어로 설정 파일을 생성하세요.');
    process.exitCode = 1;
    return;
  }

  try {
    const config = loadConfig(configPath);
    const currentEnv = getCurrentEnvironment(config);

    console.log('Current Environment');
    console.log('───────────────────');
    console.log('');
    console.log(`Name: ${currentEnv.name}`);
    console.log(`URL: ${currentEnv.n8n.url}`);
    if (currentEnv.description) {
      console.log(`Description: ${currentEnv.description}`);
    }
    if (currentEnv.isDefault) {
      console.log('Default: Yes');
    }
    if (currentEnv.tags && currentEnv.tags.length > 0) {
      console.log(`Tags: ${currentEnv.tags.join(', ')}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`✗ 오류: ${message}`);
    process.exitCode = 1;
  }
}

/**
 * 환경 전환 (env use)
 * @param targetEnv - 전환할 환경 이름
 * @param configPath - 설정 파일 경로 (선택)
 */
function switchToEnvironment(targetEnv: string, configPath?: string): void {
  const foundPath = findConfigPath(configPath);

  if (!foundPath) {
    console.log('✗ 설정 파일을 찾을 수 없습니다.');
    console.log('');
    console.log('"n8n-wfm config init" 명령어로 설정 파일을 생성하세요.');
    process.exitCode = 1;
    return;
  }

  try {
    const result = switchEnvironment(foundPath, targetEnv);

    if (result.success) {
      console.log(`✓ 환경이 "${result.previousEnv}"에서 "${result.currentEnv}"로 전환되었습니다.`);
      console.log('');

      // 전환된 환경의 상세 정보 표시
      const config = loadConfig(foundPath);
      const newEnv = getCurrentEnvironment(config);
      console.log('Current Environment:');
      console.log(`  Name: ${newEnv.name}`);
      console.log(`  URL: ${newEnv.n8n.url}`);
      if (newEnv.description) {
        console.log(`  Description: ${newEnv.description}`);
      }
    } else {
      console.log(`✗ 환경 전환 실패: ${result.error}`);
      process.exitCode = 1;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`✗ 오류: ${message}`);
    process.exitCode = 1;
  }
}

/**
 * env 명령어 등록
 * @param program - Commander 프로그램 인스턴스
 */
export function registerEnvCommand(program: Command): void {
  const envCmd = program
    .command('env')
    .description('환경 관리');

  // env list
  envCmd
    .command('list')
    .description('모든 환경 목록 표시')
    .option('-c, --config <path>', '설정 파일 경로 지정')
    .action((options: { config?: string }) => {
      printEnvironmentList(options.config);
    });

  // env current
  envCmd
    .command('current')
    .description('현재 활성 환경 표시')
    .option('-c, --config <path>', '설정 파일 경로 지정')
    .action((options: { config?: string }) => {
      printCurrentEnvironment(options.config);
    });

  // env use <name>
  envCmd
    .command('use <name>')
    .description('지정한 환경으로 전환')
    .option('-c, --config <path>', '설정 파일 경로 지정')
    .action((name: string, options: { config?: string }) => {
      switchToEnvironment(name, options.config);
    });
}
