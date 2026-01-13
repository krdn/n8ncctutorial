/**
 * 명령어 등록 모듈
 * 모든 CLI 명령어를 등록하는 중앙 관리 모듈
 */

import type { Command } from 'commander';
import { registerStatusCommand } from './status.js';

/**
 * 모든 명령어를 프로그램에 등록
 * @param program - Commander 프로그램 인스턴스
 */
export function registerCommands(program: Command): void {
  // 기본 명령어
  registerStatusCommand(program);

  // 향후 추가될 명령어들:
  // - backup: 워크플로우 백업
  // - restore: 워크플로우 복원
  // - deploy: 워크플로우 배포
  // - sync: 워크플로우 동기화
  // - list: 워크플로우 목록
}
