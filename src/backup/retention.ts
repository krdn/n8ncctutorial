/**
 * 백업 보관 정책(Retention) 관리 모듈
 * @description 오래된 백업 정리 및 백업 통계 조회 기능
 */

import * as fs from 'fs';
import * as path from 'path';
import { listBackups, deleteBackup } from './storage.js';
import type { BackupListItem } from './types.js';

/**
 * 백업 통계 정보
 * @description 백업 디렉토리의 전체 통계
 */
export interface BackupStats {
  /** 전체 백업 개수 */
  totalCount: number;
  /** 총 용량 (bytes) */
  totalSize: number;
  /** 가장 오래된 백업 ID (없으면 null) */
  oldestBackupId: string | null;
  /** 가장 오래된 백업 날짜 (없으면 null) */
  oldestBackupDate: string | null;
  /** 가장 최근 백업 ID (없으면 null) */
  latestBackupId: string | null;
  /** 가장 최근 백업 날짜 (없으면 null) */
  latestBackupDate: string | null;
  /** 환경별 백업 개수 */
  byEnvironment: Record<string, number>;
}

/**
 * 정리 결과 정보
 * @description cleanupOldBackups 실행 결과
 */
export interface CleanupResult {
  /** 삭제된 백업 ID 목록 */
  deletedBackups: string[];
  /** 삭제된 백업 개수 */
  deletedCount: number;
  /** 해제된 용량 (bytes) */
  freedSpace: number;
  /** 남은 백업 개수 */
  remainingCount: number;
}

/**
 * 디렉토리 크기 계산 (재귀적)
 * @param dirPath - 디렉토리 경로
 * @returns 총 크기 (bytes)
 */
function getDirectorySize(dirPath: string): number {
  if (!fs.existsSync(dirPath)) {
    return 0;
  }

  let totalSize = 0;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      totalSize += getDirectorySize(fullPath);
    } else if (entry.isFile()) {
      const stats = fs.statSync(fullPath);
      totalSize += stats.size;
    }
  }

  return totalSize;
}

/**
 * 오래된 백업 정리
 * @description keepCount 개수를 초과하는 오래된 백업 삭제
 * @param baseDir - 백업 기본 디렉토리
 * @param keepCount - 보관할 백업 개수 (0이면 모두 삭제)
 * @returns 정리 결과
 * @example
 * // 최근 10개만 남기고 삭제
 * const result = cleanupOldBackups('./backups', 10);
 * console.log(`${result.deletedCount}개 백업 삭제됨`);
 */
export function cleanupOldBackups(baseDir: string, keepCount: number): CleanupResult {
  const backups = listBackups(baseDir);
  const result: CleanupResult = {
    deletedBackups: [],
    deletedCount: 0,
    freedSpace: 0,
    remainingCount: backups.length,
  };

  // keepCount가 음수면 에러
  if (keepCount < 0) {
    throw new Error('keepCount는 0 이상이어야 합니다');
  }

  // 삭제할 백업 결정 (최신순 정렬된 목록에서 keepCount 이후)
  const backupsToDelete = keepCount === 0 ? backups : backups.slice(keepCount);

  for (const backup of backupsToDelete) {
    try {
      // 삭제 전 크기 계산
      const size = getDirectorySize(backup.path);

      // 백업 삭제
      deleteBackup(backup.path);

      // 결과 업데이트
      result.deletedBackups.push(backup.id);
      result.deletedCount++;
      result.freedSpace += size;
      result.remainingCount--;
    } catch {
      // 삭제 실패한 백업은 건너뛰기 (에러 무시)
      continue;
    }
  }

  return result;
}

/**
 * 백업 통계 조회
 * @description 백업 디렉토리의 전체 통계 정보 반환
 * @param baseDir - 백업 기본 디렉토리
 * @returns 백업 통계 정보
 * @example
 * const stats = getBackupStats('./backups');
 * console.log(`총 ${stats.totalCount}개 백업, ${stats.totalSize} bytes`);
 */
export function getBackupStats(baseDir: string): BackupStats {
  const backups = listBackups(baseDir);

  const stats: BackupStats = {
    totalCount: backups.length,
    totalSize: 0,
    oldestBackupId: null,
    oldestBackupDate: null,
    latestBackupId: null,
    latestBackupDate: null,
    byEnvironment: {},
  };

  if (backups.length === 0) {
    return stats;
  }

  // 총 용량 계산
  for (const backup of backups) {
    stats.totalSize += getDirectorySize(backup.path);

    // 환경별 개수 집계
    const env = backup.environment || 'unknown';
    stats.byEnvironment[env] = (stats.byEnvironment[env] || 0) + 1;
  }

  // 최신/오래된 백업 정보 (이미 최신순 정렬됨)
  const latest = backups[0];
  const oldest = backups[backups.length - 1];

  stats.latestBackupId = latest.id;
  stats.latestBackupDate = latest.timestamp;
  stats.oldestBackupId = oldest.id;
  stats.oldestBackupDate = oldest.timestamp;

  return stats;
}

/**
 * 보관 정책에 따라 삭제 대상 백업 미리보기
 * @description 실제 삭제 없이 삭제될 백업 목록만 반환
 * @param baseDir - 백업 기본 디렉토리
 * @param keepCount - 보관할 백업 개수
 * @returns 삭제 대상 백업 목록
 */
export function previewCleanup(baseDir: string, keepCount: number): BackupListItem[] {
  const backups = listBackups(baseDir);

  if (keepCount < 0) {
    throw new Error('keepCount는 0 이상이어야 합니다');
  }

  return keepCount === 0 ? backups : backups.slice(keepCount);
}

/**
 * 용량 포맷팅 (사람이 읽기 쉬운 형태)
 * @param bytes - 바이트 수
 * @returns 포맷된 문자열 (예: "1.5 MB")
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${units[i]}`;
}
