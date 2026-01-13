/**
 * 백업 목록 조회 및 표시 유틸리티
 * @description 백업 목록 조회 및 CLI 출력 포맷팅 기능
 */

import {
  listBackups,
  readManifest,
} from '../backup/storage.js';
import type { BackupListItem, BackupManifest } from '../backup/types.js';
import type { FormattedBackupDetail } from './types.js';

/**
 * 백업 목록 조회
 * @description storage.listBackups를 래핑하여 BackupListItem[] 반환
 * @param baseDir - 백업 기본 디렉토리
 * @returns 백업 목록 (최신순 정렬)
 */
export function getBackupList(baseDir: string): BackupListItem[] {
  return listBackups(baseDir);
}

/**
 * 특정 백업의 상세 매니페스트 조회
 * @description 백업 ID로 전체 매니페스트 조회
 * @param baseDir - 백업 기본 디렉토리
 * @param backupId - 조회할 백업 ID
 * @returns 백업 매니페스트
 * @throws 백업을 찾을 수 없으면 에러 발생
 */
export function getBackupDetail(baseDir: string, backupId: string): BackupManifest {
  const backups = listBackups(baseDir);
  const backup = backups.find((b) => b.id === backupId);

  if (!backup) {
    throw new Error(`백업을 찾을 수 없습니다: ${backupId}`);
  }

  return readManifest(backup.path);
}

/**
 * 날짜 문자열 포맷팅
 * @description ISO 8601 형식을 읽기 쉬운 형식으로 변환
 * @param isoString - ISO 8601 형식 날짜 문자열
 * @returns 포맷된 날짜 문자열
 */
function formatDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return isoString;
  }
}

/**
 * 백업 목록을 CLI 출력용 문자열로 포맷팅
 * @description 테이블 형식의 백업 목록 문자열 생성
 * @param backups - 백업 목록
 * @returns 포맷된 문자열
 */
export function formatBackupList(backups: BackupListItem[]): string {
  if (backups.length === 0) {
    return '백업이 없습니다.';
  }

  const lines: string[] = [];

  // 헤더
  lines.push('');
  lines.push('Backup List');
  lines.push('─'.repeat(80));
  lines.push(
    padEnd('ID', 18) +
    padEnd('Environment', 15) +
    padEnd('Workflows', 12) +
    'Timestamp'
  );
  lines.push('─'.repeat(80));

  // 각 백업 행
  for (const backup of backups) {
    lines.push(
      padEnd(backup.id, 18) +
      padEnd(backup.environment, 15) +
      padEnd(String(backup.workflowCount), 12) +
      formatDate(backup.timestamp)
    );
  }

  lines.push('─'.repeat(80));
  lines.push(`Total: ${backups.length} backup(s)`);

  return lines.join('\n');
}

/**
 * 백업 상세 정보 포맷팅 (표시용)
 * @description 백업 매니페스트를 읽기 쉬운 형식으로 포맷팅
 * @param manifest - 백업 매니페스트
 * @returns 포맷된 상세 정보 객체
 */
export function formatBackupDetail(manifest: BackupManifest): FormattedBackupDetail {
  return {
    id: manifest.metadata.id,
    timestamp: formatDate(manifest.metadata.timestamp),
    environment: manifest.metadata.environment,
    n8nUrl: manifest.metadata.n8nUrl,
    workflowCount: manifest.metadata.workflowCount,
    description: manifest.metadata.description,
    createdBy: manifest.metadata.createdBy,
    credentialsStripped: manifest.credentialsStripped,
    workflows: manifest.workflows.map((wf) => ({
      id: wf.id,
      name: wf.name,
      active: wf.active,
      updatedAt: formatDate(wf.updatedAt),
    })),
  };
}

/**
 * 백업 상세 정보를 CLI 출력용 문자열로 포맷팅
 * @description 백업 매니페스트를 읽기 쉬운 문자열로 변환
 * @param manifest - 백업 매니페스트
 * @returns 포맷된 문자열
 */
export function formatBackupDetailString(manifest: BackupManifest): string {
  const lines: string[] = [];
  const detail = formatBackupDetail(manifest);

  lines.push('');
  lines.push('Backup Details');
  lines.push('═'.repeat(60));
  lines.push('');
  lines.push(`  ID:              ${detail.id}`);
  lines.push(`  Timestamp:       ${detail.timestamp}`);
  lines.push(`  Environment:     ${detail.environment}`);
  lines.push(`  n8n URL:         ${detail.n8nUrl}`);
  lines.push(`  Workflow Count:  ${detail.workflowCount}`);
  lines.push(`  Credentials:     ${detail.credentialsStripped ? 'Stripped' : 'Included'}`);

  if (detail.description) {
    lines.push(`  Description:     ${detail.description}`);
  }

  if (detail.createdBy) {
    lines.push(`  Created By:      ${detail.createdBy}`);
  }

  lines.push('');
  lines.push('Workflows:');
  lines.push('─'.repeat(60));
  lines.push(
    '  ' +
    padEnd('ID', 10) +
    padEnd('Name', 30) +
    padEnd('Active', 10) +
    'Updated'
  );
  lines.push('─'.repeat(60));

  for (const wf of detail.workflows) {
    const activeStr = wf.active ? 'Yes' : 'No';
    lines.push(
      '  ' +
      padEnd(wf.id, 10) +
      padEnd(truncate(wf.name, 28), 30) +
      padEnd(activeStr, 10) +
      wf.updatedAt
    );
  }

  lines.push('─'.repeat(60));

  return lines.join('\n');
}

/**
 * 문자열 패딩 (오른쪽)
 * @param str - 원본 문자열
 * @param length - 목표 길이
 * @returns 패딩된 문자열
 */
function padEnd(str: string, length: number): string {
  if (str.length >= length) {
    return str;
  }
  return str + ' '.repeat(length - str.length);
}

/**
 * 문자열 자르기
 * @param str - 원본 문자열
 * @param maxLength - 최대 길이
 * @returns 잘린 문자열 (필요시 '...' 추가)
 */
function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) {
    return str;
  }
  return str.slice(0, maxLength - 3) + '...';
}
