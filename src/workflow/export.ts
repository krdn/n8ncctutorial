/**
 * 워크플로우 내보내기 모듈
 * @description n8n 워크플로우를 JSON 파일로 내보내는 기능 제공
 */

import * as fs from 'fs';
import * as path from 'path';
import type { N8nApiClient } from '../api/client.js';
import type { N8nWorkflowDetail, N8nNode } from '../types/n8n.js';

/**
 * 내보내기 옵션
 */
export interface ExportOptions {
  /** 출력 디렉토리 */
  outputDir: string;
  /** credentials 제거 여부 (기본: true) */
  stripCredentials?: boolean;
  /** JSON 포맷팅 여부 (기본: true) */
  prettyPrint?: boolean;
}

/**
 * 내보내기 결과
 */
export interface ExportResult {
  /** 워크플로우 ID */
  workflowId: string;
  /** 워크플로우 이름 */
  workflowName: string;
  /** 저장된 파일 경로 */
  filePath: string;
  /** 성공 여부 */
  success: boolean;
  /** 에러 메시지 (실패 시) */
  error?: string;
}

/**
 * 파일명에 사용할 수 없는 문자를 제거/치환
 * @param name - 원본 이름
 * @returns 안전한 파일명
 */
export function sanitizeFilename(name: string): string {
  return name
    // 공백을 언더스코어로 치환
    .replace(/\s+/g, '_')
    // 파일명에 사용할 수 없는 문자 제거 (Windows/Unix 공통)
    .replace(/[<>:"/\\|?*]/g, '')
    // 연속된 언더스코어 정리
    .replace(/_+/g, '_')
    // 앞뒤 언더스코어/점 제거
    .replace(/^[_.\s]+|[_.\s]+$/g, '')
    // 빈 문자열 방지
    || 'workflow';
}

/**
 * 워크플로우에서 credentials 정보 제거
 * @param workflow - 원본 워크플로우
 * @returns credentials가 제거된 워크플로우
 */
function stripCredentialsFromWorkflow(workflow: N8nWorkflowDetail): N8nWorkflowDetail {
  const cleanedNodes: N8nNode[] = workflow.nodes.map((node) => {
    // credentials 속성 제거
    const { credentials, ...nodeWithoutCredentials } = node;
    return nodeWithoutCredentials as N8nNode;
  });

  return {
    ...workflow,
    nodes: cleanedNodes,
  };
}

/**
 * 워크플로우를 JSON 파일로 내보내기
 * @param client - n8n API 클라이언트
 * @param id - 워크플로우 ID
 * @param options - 내보내기 옵션
 * @returns 내보내기 결과
 */
export async function exportWorkflow(
  client: N8nApiClient,
  id: string,
  options: ExportOptions
): Promise<ExportResult> {
  const { outputDir, stripCredentials = true, prettyPrint = true } = options;

  try {
    // 워크플로우 상세 정보 조회
    const workflow = await client.getWorkflow(id);

    // credentials 제거 (옵션에 따라)
    const exportData = stripCredentials
      ? stripCredentialsFromWorkflow(workflow)
      : workflow;

    // 출력 디렉토리 생성
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // 파일명 생성: {workflowName}_{id}.json
    const safeFilename = sanitizeFilename(workflow.name);
    const filename = `${safeFilename}_${workflow.id}.json`;
    const filePath = path.join(outputDir, filename);

    // JSON 변환
    const jsonContent = prettyPrint
      ? JSON.stringify(exportData, null, 2)
      : JSON.stringify(exportData);

    // 파일 저장
    fs.writeFileSync(filePath, jsonContent, 'utf-8');

    return {
      workflowId: workflow.id,
      workflowName: workflow.name,
      filePath,
      success: true,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    return {
      workflowId: id,
      workflowName: '',
      filePath: '',
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * 여러 워크플로우를 일괄 내보내기
 * @param client - n8n API 클라이언트
 * @param ids - 워크플로우 ID 배열
 * @param options - 내보내기 옵션
 * @returns 내보내기 결과 배열
 */
export async function exportWorkflows(
  client: N8nApiClient,
  ids: string[],
  options: ExportOptions
): Promise<ExportResult[]> {
  const results: ExportResult[] = [];

  for (const id of ids) {
    const result = await exportWorkflow(client, id, options);
    results.push(result);
  }

  return results;
}

/**
 * 모든 워크플로우 내보내기
 * @param client - n8n API 클라이언트
 * @param options - 내보내기 옵션
 * @returns 내보내기 결과 배열
 */
export async function exportAllWorkflows(
  client: N8nApiClient,
  options: ExportOptions
): Promise<ExportResult[]> {
  const workflows = await client.getAllWorkflows();
  const ids = workflows.map((w) => w.id);
  return exportWorkflows(client, ids, options);
}
