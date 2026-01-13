/**
 * status 명령어 모듈
 * n8n 인스턴스 연결 상태를 확인하는 명령어
 */

import type { Command } from 'commander';

/**
 * status 명령어 등록
 * @param program - Commander 프로그램 인스턴스
 */
export function registerStatusCommand(program: Command): void {
  program
    .command('status')
    .description('n8n 인스턴스 연결 상태 확인')
    .action(() => {
      // Phase 2에서 실제 연결 상태 확인 구현 예정
      console.log('Not connected to any n8n instance');
      console.log('');
      console.log('Use "n8n-wfm config" to configure your n8n connection.');
    });
}
