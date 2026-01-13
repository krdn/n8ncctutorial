/**
 * 백업 복원 실행 모듈
 * @description 백업 매니페스트를 읽고 각 워크플로우를 n8n 인스턴스로 복원
 */

import * as path from 'path';
import type { N8nApiClient } from '../api/client.js';
import { importWorkflow } from '../workflow/import.js';
import { readManifest, listBackups } from '../backup/storage.js';
import type { BackupManifest } from '../backup/types.js';
import type {
  RestoreOptions,
  RestoreResult,
  RestoreWorkflowResult,
} from './types.js';

/**
 * 복원 진행 상황 콜백 타입
 * @description 각 워크플로우 복원 완료 시 호출되는 콜백
 */
export type RestoreProgressCallback = (
  current: number,
  total: number,
  result: RestoreWorkflowResult
) => void;

/**
 * 기본 복원 옵션
 */
export const DEFAULT_RESTORE_OPTIONS: RestoreOptions = {
  mode: 'skip',
  activate: false,
  dryRun: false,
  continueOnError: true,
};

/**
 * RestoreMode를 ImportOptions의 mode로 변환
 * @param restoreMode - 복원 모드 (skip, overwrite, rename)
 * @returns importWorkflow용 모드 (create, update, upsert)
 */
function mapRestoreModeToImportMode(
  restoreMode: RestoreOptions['mode']
): 'create' | 'update' | 'upsert' {
  switch (restoreMode) {
    case 'skip':
      // skip 모드에서는 새로 생성만 시도 (중복 시 에러 발생 → 건너뛰기 처리)
      return 'create';
    case 'overwrite':
      // overwrite 모드에서는 있으면 업데이트, 없으면 생성
      return 'upsert';
    case 'rename':
      // rename 모드에서는 항상 새로 생성 (이름 충돌 시 별도 처리)
      return 'create';
    default:
      return 'upsert';
  }
}

/**
 * 백업 ID로 백업 디렉토리 경로 찾기
 * @param baseDir - 백업 기본 디렉토리
 * @param backupId - 백업 ID
 * @returns 백업 디렉토리 경로
 * @throws 백업을 찾을 수 없으면 에러 발생
 */
export function findBackupPath(baseDir: string, backupId: string): string {
  const backups = listBackups(baseDir);
  const backup = backups.find((b) => b.id === backupId);

  if (!backup) {
    throw new Error(`백업을 찾을 수 없습니다: ${backupId}`);
  }

  return backup.path;
}

/**
 * 백업 복원 실행
 * @description 백업의 모든 워크플로우를 n8n 인스턴스로 복원
 * @param client - n8n API 클라이언트
 * @param backupDir - 백업 디렉토리 경로
 * @param options - 복원 옵션
 * @param onProgress - 진행 상황 콜백 (선택)
 * @returns 복원 결과
 */
export async function restoreBackup(
  client: N8nApiClient,
  backupDir: string,
  options: Partial<RestoreOptions> = {},
  onProgress?: RestoreProgressCallback
): Promise<RestoreResult> {
  const startTime = Date.now();
  const opts: RestoreOptions = { ...DEFAULT_RESTORE_OPTIONS, ...options };

  // 매니페스트 읽기
  let manifest: BackupManifest;
  try {
    manifest = readManifest(backupDir);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      backupId: '',
      totalCount: 0,
      successCount: 0,
      failedCount: 0,
      skippedCount: 0,
      workflows: [],
      duration: Date.now() - startTime,
      error: `매니페스트 읽기 실패: ${msg}`,
    };
  }

  const backupId = manifest.metadata.id;
  const workflowList = manifest.workflows;

  // targetIds 필터링
  const targetWorkflows = opts.targetIds
    ? workflowList.filter((wf) => opts.targetIds!.includes(wf.id))
    : workflowList;

  const results: RestoreWorkflowResult[] = [];
  let successCount = 0;
  let failedCount = 0;
  let skippedCount = 0;

  // 각 워크플로우 복원
  for (let i = 0; i < targetWorkflows.length; i++) {
    const wfInfo = targetWorkflows[i];
    const workflowFilePath = path.join(backupDir, wfInfo.filename);

    // dry-run 모드: 실제 복원 없이 계획만 반환
    if (opts.dryRun) {
      const result: RestoreWorkflowResult = {
        originalId: wfInfo.id,
        name: wfInfo.name,
        success: true,
        action: 'skipped',
      };
      results.push(result);
      skippedCount++;

      if (onProgress) {
        onProgress(i + 1, targetWorkflows.length, result);
      }
      continue;
    }

    // 실제 복원 실행
    try {
      const importMode = mapRestoreModeToImportMode(opts.mode);
      const importResult = await importWorkflow(client, workflowFilePath, {
        mode: importMode,
        activate: opts.activate,
      });

      if (importResult.success) {
        const result: RestoreWorkflowResult = {
          originalId: wfInfo.id,
          restoredId: importResult.workflowId,
          name: importResult.workflowName || wfInfo.name,
          success: true,
          action: importResult.action,
        };
        results.push(result);
        successCount++;

        if (onProgress) {
          onProgress(i + 1, targetWorkflows.length, result);
        }
      } else {
        // skip 모드에서 이름 중복으로 실패한 경우 건너뛰기로 처리
        if (
          opts.mode === 'skip' &&
          importResult.error?.includes('already exists')
        ) {
          const result: RestoreWorkflowResult = {
            originalId: wfInfo.id,
            name: wfInfo.name,
            success: true,
            action: 'skipped',
          };
          results.push(result);
          skippedCount++;

          if (onProgress) {
            onProgress(i + 1, targetWorkflows.length, result);
          }
        } else {
          const result: RestoreWorkflowResult = {
            originalId: wfInfo.id,
            name: wfInfo.name,
            success: false,
            error: importResult.error,
          };
          results.push(result);
          failedCount++;

          if (onProgress) {
            onProgress(i + 1, targetWorkflows.length, result);
          }

          // continueOnError가 false이면 중단
          if (opts.continueOnError === false) {
            break;
          }
        }
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      const result: RestoreWorkflowResult = {
        originalId: wfInfo.id,
        name: wfInfo.name,
        success: false,
        error: msg,
      };
      results.push(result);
      failedCount++;

      if (onProgress) {
        onProgress(i + 1, targetWorkflows.length, result);
      }

      // continueOnError가 false이면 중단
      if (opts.continueOnError === false) {
        break;
      }
    }
  }

  const duration = Date.now() - startTime;

  return {
    success: failedCount === 0,
    backupId,
    totalCount: targetWorkflows.length,
    successCount,
    failedCount,
    skippedCount,
    workflows: results,
    duration,
  };
}

/**
 * 복원 계획 미리보기 (dry-run)
 * @description 실제 복원 없이 복원 대상 워크플로우 목록 반환
 * @param backupDir - 백업 디렉토리 경로
 * @param options - 복원 옵션 (targetIds만 사용)
 * @returns 복원 대상 워크플로우 목록
 */
export function previewRestore(
  backupDir: string,
  options: Partial<RestoreOptions> = {}
): {
  backupId: string;
  environment: string;
  n8nUrl: string;
  totalCount: number;
  workflows: { id: string; name: string; active: boolean }[];
} {
  const manifest = readManifest(backupDir);
  const workflowList = manifest.workflows;

  // targetIds 필터링
  const targetWorkflows = options.targetIds
    ? workflowList.filter((wf) => options.targetIds!.includes(wf.id))
    : workflowList;

  return {
    backupId: manifest.metadata.id,
    environment: manifest.metadata.environment,
    n8nUrl: manifest.metadata.n8nUrl,
    totalCount: targetWorkflows.length,
    workflows: targetWorkflows.map((wf) => ({
      id: wf.id,
      name: wf.name,
      active: wf.active,
    })),
  };
}
