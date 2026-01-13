/**
 * 백업 모듈 진입점
 * @description 백업 관련 타입 및 유틸리티 함수 공개 API
 */

// 타입 re-export
export type {
  BackupMetadata,
  BackupWorkflowInfo,
  BackupManifest,
  BackupOptions,
  BackupResult,
  BackupListItem,
} from './types.js';

// 저장소 유틸리티 re-export
export {
  generateBackupId,
  createBackupDirectory,
  writeManifest,
  readManifest,
  isValidBackupId,
  listBackups,
  getLatestBackup,
  deleteBackup,
  pruneOldBackups,
} from './storage.js';
