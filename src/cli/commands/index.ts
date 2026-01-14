/**
 * 명령어 등록 모듈
 * @description 모든 CLI 명령어를 등록하는 중앙 관리 모듈
 */

import type { Command } from 'commander';
import { registerStatusCommand } from './status.js';
import { registerConfigCommand } from './config.js';
import { registerExportCommand, registerExportAllCommand } from './export.js';
import { registerImportCommand, registerImportAllCommand } from './import.js';
import { registerBackupCommand } from './backup.js';
import { registerRestoreCommand } from './restore.js';
import { registerVersionCommand } from './version.js';
import { registerEnvCommand } from './env.js';
import { registerDeployCommand } from './deploy.js';

/**
 * 모든 명령어를 프로그램에 등록
 * @param program - Commander 프로그램 인스턴스
 */
export function registerCommands(program: Command): void {
  // 상태 확인
  registerStatusCommand(program);

  // 설정 관리
  registerConfigCommand(program);

  // 워크플로우 내보내기
  registerExportCommand(program);

  // 워크플로우 전체 내보내기
  registerExportAllCommand(program);

  // 워크플로우 가져오기
  registerImportCommand(program);

  // 워크플로우 전체 가져오기
  registerImportAllCommand(program);

  // 워크플로우 백업
  registerBackupCommand(program);

  // 워크플로우 복원
  registerRestoreCommand(program);

  // 버전 관리 (Git)
  registerVersionCommand(program);

  // 환경 관리
  registerEnvCommand(program);

  // 워크플로우 배포
  registerDeployCommand(program);

  // 향후 추가될 명령어들:
  // - sync: 워크플로우 동기화
  // - list: 워크플로우 목록
}
