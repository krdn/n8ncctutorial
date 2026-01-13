/**
 * 벌크 내보내기/가져오기 모듈
 * @description 여러 워크플로우를 한 번에 내보내거나 가져오는 기능 제공
 */

import * as fs from 'fs';
import * as path from 'path';
import type { N8nApiClient } from '../api/client.js';
import type { N8nWorkflow } from '../types/n8n.js';
import { exportWorkflow, type ExportOptions, type ExportResult } from './export.js';
import { importWorkflow, type ImportOptions, type ImportResult } from './import.js';

/**
 * 벌크 내보내기 옵션
 */
export interface BulkExportOptions extends ExportOptions {
  /** 워크플로우 필터링 함수 */
  filter?: (workflow: N8nWorkflow) => boolean;
}

/**
 * 벌크 내보내기 결과
 */
export interface BulkExportResult {
  /** 전체 워크플로우 수 */
  total: number;
  /** 성공한 워크플로우 수 */
  succeeded: number;
  /** 실패한 워크플로우 수 */
  failed: number;
  /** 개별 결과 배열 */
  results: ExportResult[];
}

/**
 * 벌크 가져오기 옵션
 */
export interface BulkImportOptions extends ImportOptions {
  /** 에러 발생 시 계속 진행 여부 (기본: true) */
  continueOnError?: boolean;
}

/**
 * 벌크 가져오기 결과
 */
export interface BulkImportResult {
  /** 전체 파일 수 */
  total: number;
  /** 성공한 파일 수 */
  succeeded: number;
  /** 실패한 파일 수 */
  failed: number;
  /** 개별 결과 배열 */
  results: ImportResult[];
}

/**
 * 진행 상황 콜백 타입
 */
export type ProgressCallback = (
  current: number,
  total: number,
  name: string,
  success: boolean,
  error?: string
) => void;

/**
 * 모든 워크플로우 내보내기
 * @param client - n8n API 클라이언트
 * @param options - 벌크 내보내기 옵션
 * @param onProgress - 진행 상황 콜백 (선택)
 * @returns 벌크 내보내기 결과
 */
export async function exportAllWorkflows(
  client: N8nApiClient,
  options: BulkExportOptions,
  onProgress?: ProgressCallback
): Promise<BulkExportResult> {
  // 모든 워크플로우 목록 조회
  let workflows = await client.getAllWorkflows();

  // 필터 적용
  if (options.filter) {
    workflows = workflows.filter(options.filter);
  }

  const results: ExportResult[] = [];
  let succeeded = 0;
  let failed = 0;

  // 각 워크플로우 내보내기
  for (let i = 0; i < workflows.length; i++) {
    const workflow = workflows[i];

    // 개별 워크플로우 내보내기 (실패해도 계속 진행)
    const result = await exportWorkflow(client, workflow.id, {
      outputDir: options.outputDir,
      stripCredentials: options.stripCredentials,
      prettyPrint: options.prettyPrint,
    });

    results.push(result);

    if (result.success) {
      succeeded++;
    } else {
      failed++;
    }

    // 진행 상황 콜백 호출
    if (onProgress) {
      onProgress(
        i + 1,
        workflows.length,
        result.workflowName || workflow.name,
        result.success,
        result.error
      );
    }
  }

  return {
    total: workflows.length,
    succeeded,
    failed,
    results,
  };
}

/**
 * 디렉토리에서 모든 워크플로우 가져오기
 * @param client - n8n API 클라이언트
 * @param directory - JSON 파일들이 있는 디렉토리 경로
 * @param options - 벌크 가져오기 옵션
 * @param onProgress - 진행 상황 콜백 (선택)
 * @returns 벌크 가져오기 결과
 */
export async function importAllWorkflows(
  client: N8nApiClient,
  directory: string,
  options: BulkImportOptions,
  onProgress?: ProgressCallback
): Promise<BulkImportResult> {
  const { continueOnError = true, ...importOptions } = options;

  // 디렉토리 존재 확인
  if (!fs.existsSync(directory)) {
    return {
      total: 0,
      succeeded: 0,
      failed: 0,
      results: [{
        workflowId: '',
        workflowName: '',
        action: 'skipped',
        success: false,
        error: `Directory not found: ${directory}`,
      }],
    };
  }

  // 디렉토리인지 확인
  const stat = fs.statSync(directory);
  if (!stat.isDirectory()) {
    return {
      total: 0,
      succeeded: 0,
      failed: 0,
      results: [{
        workflowId: '',
        workflowName: '',
        action: 'skipped',
        success: false,
        error: `Not a directory: ${directory}`,
      }],
    };
  }

  // *.json 파일 목록 조회
  const files = fs.readdirSync(directory)
    .filter((file) => file.endsWith('.json'))
    .map((file) => path.join(directory, file))
    .sort(); // 알파벳 순 정렬

  if (files.length === 0) {
    return {
      total: 0,
      succeeded: 0,
      failed: 0,
      results: [],
    };
  }

  const results: ImportResult[] = [];
  let succeeded = 0;
  let failed = 0;

  // 각 파일에서 워크플로우 가져오기
  for (let i = 0; i < files.length; i++) {
    const filePath = files[i];
    const fileName = path.basename(filePath);

    // 개별 파일 가져오기
    const result = await importWorkflow(client, filePath, importOptions);

    results.push(result);

    if (result.success) {
      succeeded++;
    } else {
      failed++;

      // continueOnError가 false면 중단
      if (!continueOnError) {
        // 진행 상황 콜백 호출 (실패)
        if (onProgress) {
          onProgress(
            i + 1,
            files.length,
            result.workflowName || fileName,
            result.success,
            result.error
          );
        }
        break;
      }
    }

    // 진행 상황 콜백 호출
    if (onProgress) {
      onProgress(
        i + 1,
        files.length,
        result.workflowName || fileName,
        result.success,
        result.error
      );
    }
  }

  return {
    total: files.length,
    succeeded,
    failed,
    results,
  };
}
