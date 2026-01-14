/**
 * 롤백 모듈
 * @description 배포 롤백 및 배포 기록 관리 기능 구현
 */

import * as fs from 'fs';
import * as path from 'path';
import type { N8nApiClient } from '../api/client.js';
import type { DeploymentRecord } from './types.js';
import { restoreBackup } from '../restore/restore.js';

/**
 * 롤백 옵션
 */
export interface RollbackOptions {
  /** 특정 배포 ID로 롤백 (없으면 최신 배포 사용) */
  deploymentId?: string;
  /** 특정 워크플로우 ID만 롤백 */
  workflowIds?: string[];
}

/**
 * 롤백 결과
 */
export interface RollbackResult {
  /** 롤백 성공 여부 */
  success: boolean;
  /** 복원된 워크플로우 수 */
  restoredCount: number;
  /** 에러 목록 */
  errors: string[];
}

/**
 * 배포 기록 디렉토리 경로
 */
const DEPLOYMENTS_DIR = '.n8n-wfm/deployments';

/**
 * 배포 기록 저장
 * @description 배포 기록을 JSON 파일로 저장
 * @param record - 배포 기록
 * @param outputDir - 출력 기본 디렉토리
 * @returns 저장된 파일 경로
 */
export async function saveDeploymentRecord(
  record: DeploymentRecord,
  outputDir: string
): Promise<string> {
  // 배포 기록 디렉토리 생성
  const deploymentsPath = path.join(outputDir, DEPLOYMENTS_DIR);

  if (!fs.existsSync(deploymentsPath)) {
    fs.mkdirSync(deploymentsPath, { recursive: true });
  }

  // 파일명: {timestamp}.json
  const filename = `${record.id}.json`;
  const filePath = path.join(deploymentsPath, filename);

  // JSON 파일로 저장
  fs.writeFileSync(filePath, JSON.stringify(record, null, 2), 'utf-8');

  return filePath;
}

/**
 * 배포 기록 로드
 * @description 특정 배포 ID의 기록 로드
 * @param deploymentId - 배포 ID
 * @param baseDir - 기본 디렉토리
 * @returns 배포 기록 또는 null
 */
export async function loadDeploymentRecord(
  deploymentId: string,
  baseDir: string
): Promise<DeploymentRecord | null> {
  const deploymentsPath = path.join(baseDir, DEPLOYMENTS_DIR);
  const filePath = path.join(deploymentsPath, `${deploymentId}.json`);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as DeploymentRecord;
  } catch {
    return null;
  }
}

/**
 * 모든 배포 기록 목록 조회
 * @description 저장된 모든 배포 기록 조회 (최신 순)
 * @param baseDir - 기본 디렉토리
 * @returns 배포 기록 목록
 */
export async function listDeploymentRecords(baseDir: string): Promise<DeploymentRecord[]> {
  const deploymentsPath = path.join(baseDir, DEPLOYMENTS_DIR);

  if (!fs.existsSync(deploymentsPath)) {
    return [];
  }

  const files = fs.readdirSync(deploymentsPath);
  const jsonFiles = files.filter((f) => f.endsWith('.json'));

  const records: DeploymentRecord[] = [];

  for (const file of jsonFiles) {
    try {
      const content = fs.readFileSync(path.join(deploymentsPath, file), 'utf-8');
      const record = JSON.parse(content) as DeploymentRecord;
      records.push(record);
    } catch {
      // 파싱 실패한 파일은 건너뜀
      console.warn(`Warning: 배포 기록 파싱 실패: ${file}`);
    }
  }

  // 타임스탬프 기준 내림차순 정렬 (최신 순)
  records.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return records;
}

/**
 * 가장 최근 배포 기록 조회
 * @description 최신 배포 기록 반환
 * @param baseDir - 기본 디렉토리
 * @returns 최신 배포 기록 또는 null
 */
export async function getLatestDeploymentRecord(
  baseDir: string
): Promise<DeploymentRecord | null> {
  const records = await listDeploymentRecords(baseDir);
  return records.length > 0 ? records[0] : null;
}

/**
 * 배포 롤백 실행
 * @description 배포 기록의 백업을 사용하여 이전 상태로 복원
 * @param client - n8n API 클라이언트 (대상 환경)
 * @param record - 배포 기록
 * @param options - 롤백 옵션
 * @returns 롤백 결과
 */
export async function rollbackDeployment(
  client: N8nApiClient,
  record: DeploymentRecord,
  options: RollbackOptions = {}
): Promise<RollbackResult> {
  const errors: string[] = [];
  let restoredCount = 0;

  // 백업 경로 확인
  if (!record.backupPath) {
    return {
      success: false,
      restoredCount: 0,
      errors: ['배포 기록에 백업 경로가 없습니다. 롤백할 수 없습니다.'],
    };
  }

  // 백업 디렉토리 존재 확인
  if (!fs.existsSync(record.backupPath)) {
    return {
      success: false,
      restoredCount: 0,
      errors: [`백업 경로를 찾을 수 없습니다: ${record.backupPath}`],
    };
  }

  // 롤백 대상 워크플로우 필터링
  let targetWorkflows = record.workflows;

  if (options.workflowIds && options.workflowIds.length > 0) {
    targetWorkflows = record.workflows.filter(
      (wf) =>
        options.workflowIds!.includes(wf.originalId) ||
        options.workflowIds!.includes(wf.targetId)
    );

    if (targetWorkflows.length === 0) {
      return {
        success: false,
        restoredCount: 0,
        errors: ['지정된 워크플로우 ID가 배포 기록에 없습니다.'],
      };
    }
  }

  // 복원 대상 ID 목록 생성
  const targetIds = targetWorkflows.map((wf) => wf.targetId);

  try {
    // 백업에서 복원 실행
    const restoreResult = await restoreBackup(client, record.backupPath, {
      mode: 'overwrite',
      activate: false,
      targetIds,
      continueOnError: true,
    });

    restoredCount = restoreResult.successCount;

    // 실패한 워크플로우 에러 수집
    for (const wfResult of restoreResult.workflows) {
      if (!wfResult.success && wfResult.error) {
        errors.push(`워크플로우 "${wfResult.name}" 복원 실패: ${wfResult.error}`);
      }
    }

    if (restoreResult.error) {
      errors.push(restoreResult.error);
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    errors.push(`롤백 실행 중 오류: ${msg}`);
  }

  return {
    success: errors.length === 0,
    restoredCount,
    errors,
  };
}

/**
 * 배포 기록 삭제
 * @description 특정 배포 기록 파일 삭제
 * @param deploymentId - 배포 ID
 * @param baseDir - 기본 디렉토리
 * @returns 삭제 성공 여부
 */
export async function deleteDeploymentRecord(
  deploymentId: string,
  baseDir: string
): Promise<boolean> {
  const deploymentsPath = path.join(baseDir, DEPLOYMENTS_DIR);
  const filePath = path.join(deploymentsPath, `${deploymentId}.json`);

  if (!fs.existsSync(filePath)) {
    return false;
  }

  try {
    fs.unlinkSync(filePath);
    return true;
  } catch {
    return false;
  }
}
