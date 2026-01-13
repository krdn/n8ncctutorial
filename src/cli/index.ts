/**
 * CLI 메인 모듈
 * Commander.js를 사용한 CLI 프레임워크
 */

import { Command } from 'commander';
import { createRequire } from 'module';
import { registerCommands } from './commands/index.js';

// ES Module에서 package.json 읽기
const require = createRequire(import.meta.url);
const packageJson = require('../../package.json');

/**
 * CLI Program 인스턴스
 */
export const program = new Command();

// 프로그램 기본 설정
program
  .name('n8n-wfm')
  .description('n8n Workflow Manager - 워크플로우 자동 관리 도구')
  .version(packageJson.version, '-v, --version', '버전 정보 출력');

// 명령어 등록
registerCommands(program);
