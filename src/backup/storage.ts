/**
 * 백업 저장소 유틸리티
 * @description 백업 디렉토리 및 매니페스트 관리 기능
 */

import * as fs from 'fs';
import * as path from 'path';
import type { BackupManifest, BackupListItem } from './types.js';

/** 매니페스트 파일명 */
const MANIFEST_FILENAME = 'manifest.json';

/**
 * 타임스탬프 기반 백업 ID 생성
 * @description YYYYMMDD_HHmmss 형식의 고유 백업 ID 생성
 * @param date - 사용할 날짜 (기본: 현재 시각)
 * @returns 백업 ID 문자열
 * @example
 * generateBackupId() // "20250114_153042"
 */
export function generateBackupId(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return `${year}${month}${day}_${hours}${minutes}${seconds}`;
}

/**
 * 백업 디렉토리 생성
 * @description baseDir 아래에 backupId 이름의 디렉토리 생성
 * @param baseDir - 백업 기본 디렉토리
 * @param backupId - 백업 ID
 * @returns 생성된 백업 디렉토리 전체 경로
 * @throws 디렉토리 생성 실패 시 에러 발생
 */
export function createBackupDirectory(baseDir: string, backupId: string): string {
  const backupDir = path.join(baseDir, backupId);

  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }

  if (fs.existsSync(backupDir)) {
    throw new Error(`백업 디렉토리가 이미 존재합니다: ${backupDir}`);
  }

  fs.mkdirSync(backupDir, { recursive: true });
  return backupDir;
}

/**
 * 매니페스트 파일 저장
 * @description 백업 디렉토리에 manifest.json 저장
 * @param backupDir - 백업 디렉토리 경로
 * @param manifest - 매니페스트 데이터
 * @param prettyPrint - JSON 포맷팅 여부 (기본: true)
 * @returns 저장된 매니페스트 파일 경로
 */
export function writeManifest(
  backupDir: string,
  manifest: BackupManifest,
  prettyPrint: boolean = true
): string {
  const manifestPath = path.join(backupDir, MANIFEST_FILENAME);
  const content = prettyPrint
    ? JSON.stringify(manifest, null, 2)
    : JSON.stringify(manifest);

  fs.writeFileSync(manifestPath, content, 'utf-8');
  return manifestPath;
}

/**
 * 매니페스트 파일 읽기
 * @description 백업 디렉토리에서 manifest.json 읽기
 * @param backupDir - 백업 디렉토리 경로
 * @returns 매니페스트 데이터
 * @throws 파일이 없거나 파싱 실패 시 에러 발생
 */
export function readManifest(backupDir: string): BackupManifest {
  const manifestPath = path.join(backupDir, MANIFEST_FILENAME);

  if (!fs.existsSync(manifestPath)) {
    throw new Error(`매니페스트 파일을 찾을 수 없습니다: ${manifestPath}`);
  }

  const content = fs.readFileSync(manifestPath, 'utf-8');
  return JSON.parse(content) as BackupManifest;
}

/**
 * 백업 ID가 유효한 형식인지 확인
 * @description YYYYMMDD_HHmmss 형식 검증
 * @param id - 검증할 백업 ID
 * @returns 유효 여부
 */
export function isValidBackupId(id: string): boolean {
  // YYYYMMDD_HHmmss 형식: 15자, 숫자와 언더스코어
  return /^\d{8}_\d{6}$/.test(id);
}

/**
 * 백업 목록 조회
 * @description baseDir 내의 모든 백업 디렉토리 조회
 * @param baseDir - 백업 기본 디렉토리
 * @returns 백업 목록 (최신순 정렬)
 */
export function listBackups(baseDir: string): BackupListItem[] {
  if (!fs.existsSync(baseDir)) {
    return [];
  }

  const entries = fs.readdirSync(baseDir, { withFileTypes: true });
  const backups: BackupListItem[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (!isValidBackupId(entry.name)) continue;

    const backupDir = path.join(baseDir, entry.name);
    const manifestPath = path.join(backupDir, MANIFEST_FILENAME);

    // manifest.json이 없는 디렉토리는 건너뛰기
    if (!fs.existsSync(manifestPath)) continue;

    try {
      const manifest = readManifest(backupDir);
      backups.push({
        id: manifest.metadata.id,
        path: backupDir,
        timestamp: manifest.metadata.timestamp,
        environment: manifest.metadata.environment,
        workflowCount: manifest.metadata.workflowCount,
      });
    } catch {
      // 매니페스트 읽기 실패한 디렉토리는 건너뛰기
      continue;
    }
  }

  // 최신순 정렬 (ID가 타임스탬프 기반이므로 ID 역순 정렬)
  return backups.sort((a, b) => b.id.localeCompare(a.id));
}

/**
 * 가장 최근 백업 정보 조회
 * @description baseDir 내에서 가장 최근 백업의 매니페스트 반환
 * @param baseDir - 백업 기본 디렉토리
 * @returns 최근 백업 매니페스트 또는 null (백업 없음)
 */
export function getLatestBackup(baseDir: string): BackupManifest | null {
  const backups = listBackups(baseDir);

  if (backups.length === 0) {
    return null;
  }

  // 가장 최신 백업의 전체 매니페스트 반환
  return readManifest(backups[0].path);
}

/**
 * 백업 디렉토리 삭제
 * @description 백업 디렉토리와 모든 내용물 삭제
 * @param backupDir - 삭제할 백업 디렉토리 경로
 * @throws 디렉토리가 존재하지 않으면 에러 발생
 */
export function deleteBackup(backupDir: string): void {
  if (!fs.existsSync(backupDir)) {
    throw new Error(`백업 디렉토리를 찾을 수 없습니다: ${backupDir}`);
  }

  fs.rmSync(backupDir, { recursive: true, force: true });
}

/**
 * 오래된 백업 정리
 * @description retention 개수를 초과하는 오래된 백업 삭제
 * @param baseDir - 백업 기본 디렉토리
 * @param retention - 보관할 백업 개수
 * @returns 삭제된 백업 ID 목록
 */
export function pruneOldBackups(baseDir: string, retention: number): string[] {
  if (retention < 1) {
    throw new Error('retention은 1 이상이어야 합니다');
  }

  const backups = listBackups(baseDir);
  const deletedIds: string[] = [];

  // retention 개수를 초과하는 오래된 백업들 삭제
  const backupsToDelete = backups.slice(retention);

  for (const backup of backupsToDelete) {
    try {
      deleteBackup(backup.path);
      deletedIds.push(backup.id);
    } catch {
      // 삭제 실패한 백업은 건너뛰기
      continue;
    }
  }

  return deletedIds;
}
