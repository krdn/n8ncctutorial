/**
 * 백업 실행 모듈
 * @description 워크플로우 백업 핵심 로직 구현
 */

import * as path from 'path';
import type { N8nApiClient } from '../api/client.js';
import type { N8nWorkflow } from '../types/n8n.js';
import {
  bulkExportWorkflows,
  exportWorkflows,
  type BulkExportResult,
  type ProgressCallback,
} from '../workflow/index.js';
import type {
  BackupOptions,
  BackupResult,
  BackupManifest,
  BackupWorkflowInfo,
} from './types.js';
import {
  generateBackupId,
  createBackupDirectory,
  writeManifest,
} from './storage.js';

/**
 * 백업 실행 옵션 (내부용 확장)
 */
interface InternalBackupOptions extends BackupOptions {
  /** 환경 이름 */
  environment: string;
  /** n8n 인스턴스 URL */
  n8nUrl: string;
  /** 활성 워크플로우만 백업 */
  activeOnly?: boolean;
}

/**
 * 전체 워크플로우 백업 수행
 * @description 모든 (또는 필터링된) 워크플로우를 백업하고 매니페스트 생성
 * @param client - n8n API 클라이언트
 * @param options - 백업 옵션
 * @param onProgress - 진행 상황 콜백 (선택)
 * @returns 백업 결과
 */
export async function createBackup(
  client: N8nApiClient,
  options: InternalBackupOptions,
  onProgress?: ProgressCallback
): Promise<BackupResult> {
  const startTime = Date.now();
  const backupId = generateBackupId();

  try {
    // 백업 디렉토리 생성
    const backupPath = createBackupDirectory(options.baseDir, backupId);

    // 필터 함수 생성 (activeOnly 옵션)
    const filter = options.activeOnly
      ? (workflow: N8nWorkflow) => workflow.active === true
      : undefined;

    // 벌크 내보내기 실행
    const exportResult: BulkExportResult = await bulkExportWorkflows(
      client,
      {
        outputDir: backupPath,
        stripCredentials: options.stripCredentials ?? true,
        prettyPrint: options.prettyPrint ?? true,
        filter,
      },
      onProgress
    );

    // 매니페스트 생성을 위한 워크플로우 정보 수집
    const workflowInfos: BackupWorkflowInfo[] = exportResult.results
      .filter((r) => r.success)
      .map((r) => ({
        id: r.workflowId,
        name: r.workflowName,
        active: false, // 내보내기 결과에서는 active 정보가 없으므로 기본값
        filename: path.basename(r.filePath),
        updatedAt: new Date().toISOString(),
      }));

    // 매니페스트 생성
    const manifest: BackupManifest = {
      version: '1.0',
      metadata: {
        id: backupId,
        timestamp: new Date().toISOString(),
        environment: options.environment,
        n8nUrl: options.n8nUrl,
        workflowCount: exportResult.succeeded,
        description: options.description,
      },
      workflows: workflowInfos,
      credentialsStripped: options.stripCredentials ?? true,
    };

    // 매니페스트 저장
    writeManifest(backupPath, manifest, options.prettyPrint ?? true);

    // 실패한 워크플로우 ID 수집
    const failedWorkflows = exportResult.results
      .filter((r) => !r.success)
      .map((r) => r.workflowId);

    const duration = Date.now() - startTime;

    return {
      success: exportResult.failed === 0,
      backupId,
      backupPath,
      successCount: exportResult.succeeded,
      failedCount: exportResult.failed,
      failedWorkflows,
      duration,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    return {
      success: false,
      backupId,
      backupPath: '',
      successCount: 0,
      failedCount: 0,
      failedWorkflows: [],
      duration,
      error: errorMessage,
    };
  }
}

/**
 * 선택적 워크플로우 백업 수행
 * @description 지정된 워크플로우 ID들만 백업
 * @param client - n8n API 클라이언트
 * @param workflowIds - 백업할 워크플로우 ID 배열
 * @param options - 백업 옵션
 * @param onProgress - 진행 상황 콜백 (선택)
 * @returns 백업 결과
 */
export async function createSelectiveBackup(
  client: N8nApiClient,
  workflowIds: string[],
  options: InternalBackupOptions,
  onProgress?: ProgressCallback
): Promise<BackupResult> {
  const startTime = Date.now();
  const backupId = generateBackupId();

  try {
    // 백업 디렉토리 생성
    const backupPath = createBackupDirectory(options.baseDir, backupId);

    // 선택적 내보내기 실행
    const exportResults = await exportWorkflows(client, workflowIds, {
      outputDir: backupPath,
      stripCredentials: options.stripCredentials ?? true,
      prettyPrint: options.prettyPrint ?? true,
    });

    // 진행 상황 콜백 호출
    if (onProgress) {
      exportResults.forEach((result, index) => {
        onProgress(
          index + 1,
          workflowIds.length,
          result.workflowName || result.workflowId,
          result.success,
          result.error
        );
      });
    }

    // 성공/실패 집계
    const succeededResults = exportResults.filter((r) => r.success);
    const failedResults = exportResults.filter((r) => !r.success);

    // 매니페스트 생성을 위한 워크플로우 정보 수집
    const workflowInfos: BackupWorkflowInfo[] = succeededResults.map((r) => ({
      id: r.workflowId,
      name: r.workflowName,
      active: false,
      filename: path.basename(r.filePath),
      updatedAt: new Date().toISOString(),
    }));

    // 매니페스트 생성
    const manifest: BackupManifest = {
      version: '1.0',
      metadata: {
        id: backupId,
        timestamp: new Date().toISOString(),
        environment: options.environment,
        n8nUrl: options.n8nUrl,
        workflowCount: succeededResults.length,
        description: options.description,
      },
      workflows: workflowInfos,
      credentialsStripped: options.stripCredentials ?? true,
    };

    // 매니페스트 저장
    writeManifest(backupPath, manifest, options.prettyPrint ?? true);

    const duration = Date.now() - startTime;

    return {
      success: failedResults.length === 0,
      backupId,
      backupPath,
      successCount: succeededResults.length,
      failedCount: failedResults.length,
      failedWorkflows: failedResults.map((r) => r.workflowId),
      duration,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    return {
      success: false,
      backupId,
      backupPath: '',
      successCount: 0,
      failedCount: 0,
      failedWorkflows: [],
      duration,
      error: errorMessage,
    };
  }
}
