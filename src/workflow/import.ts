/**
 * 워크플로우 가져오기 모듈
 * @description JSON 파일에서 워크플로우를 n8n 인스턴스로 가져오는 기능
 */

import * as fs from 'fs';
import type { N8nApiClient } from '../api/client.js';
import type { N8nWorkflow, N8nWorkflowDetail } from '../types/n8n.js';

/**
 * 워크플로우 가져오기 옵션
 */
export interface ImportOptions {
  /** 가져오기 모드: create(새로 생성), update(기존 업데이트), upsert(있으면 업데이트, 없으면 생성) */
  mode: 'create' | 'update' | 'upsert';
  /** 가져온 후 워크플로우 활성화 여부 */
  activate: boolean;
}

/**
 * 워크플로우 가져오기 결과
 */
export interface ImportResult {
  /** 워크플로우 ID */
  workflowId: string;
  /** 워크플로우 이름 */
  workflowName: string;
  /** 수행된 작업 */
  action: 'created' | 'updated' | 'skipped';
  /** 성공 여부 */
  success: boolean;
  /** 에러 메시지 (실패 시) */
  error?: string;
}

/**
 * 기본 가져오기 옵션
 */
export const DEFAULT_IMPORT_OPTIONS: ImportOptions = {
  mode: 'create',
  activate: false,
};

/**
 * 워크플로우 JSON 유효성 검증
 * @param data - 검증할 데이터
 * @returns 유효한 워크플로우 데이터 또는 null
 */
export function validateWorkflowJson(data: unknown): N8nWorkflowDetail | null {
  // 객체인지 확인
  if (typeof data !== 'object' || data === null) {
    return null;
  }

  const obj = data as Record<string, unknown>;

  // 필수 필드 확인: name, nodes, connections
  if (typeof obj.name !== 'string' || obj.name.trim() === '') {
    return null;
  }

  if (!Array.isArray(obj.nodes)) {
    return null;
  }

  if (typeof obj.connections !== 'object' || obj.connections === null) {
    return null;
  }

  // 유효한 워크플로우로 타입 캐스팅
  return data as N8nWorkflowDetail;
}

/**
 * 이름으로 워크플로우 검색
 * @param client - n8n API 클라이언트
 * @param name - 워크플로우 이름
 * @returns 찾은 워크플로우 또는 null
 */
export async function findWorkflowByName(
  client: N8nApiClient,
  name: string
): Promise<N8nWorkflow | null> {
  const workflows = await client.getAllWorkflows();
  return workflows.find((w) => w.name === name) ?? null;
}

/**
 * JSON 파일에서 워크플로우 가져오기
 * @param client - n8n API 클라이언트
 * @param filePath - JSON 파일 경로
 * @param options - 가져오기 옵션
 * @returns 가져오기 결과
 */
export async function importWorkflow(
  client: N8nApiClient,
  filePath: string,
  options: Partial<ImportOptions> = {}
): Promise<ImportResult> {
  // 옵션 병합
  const opts: ImportOptions = { ...DEFAULT_IMPORT_OPTIONS, ...options };

  // 파일 존재 확인
  if (!fs.existsSync(filePath)) {
    return {
      workflowId: '',
      workflowName: '',
      action: 'skipped',
      success: false,
      error: `File not found: ${filePath}`,
    };
  }

  // 파일 읽기
  let fileContent: string;
  try {
    fileContent = fs.readFileSync(filePath, 'utf-8');
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return {
      workflowId: '',
      workflowName: '',
      action: 'skipped',
      success: false,
      error: `Failed to read file: ${msg}`,
    };
  }

  // JSON 파싱
  let jsonData: unknown;
  try {
    jsonData = JSON.parse(fileContent);
  } catch {
    return {
      workflowId: '',
      workflowName: '',
      action: 'skipped',
      success: false,
      error: 'Invalid JSON file',
    };
  }

  // 워크플로우 검증
  const workflow = validateWorkflowJson(jsonData);
  if (!workflow) {
    // 어떤 필드가 누락되었는지 상세 메시지
    const obj = jsonData as Record<string, unknown> | null;
    const missingFields: string[] = [];
    if (!obj || typeof obj !== 'object') {
      missingFields.push('valid object');
    } else {
      if (typeof obj.name !== 'string' || obj.name === '') missingFields.push('name');
      if (!Array.isArray(obj.nodes)) missingFields.push('nodes');
      if (typeof obj.connections !== 'object') missingFields.push('connections');
    }
    return {
      workflowId: '',
      workflowName: '',
      action: 'skipped',
      success: false,
      error: `Invalid workflow format: missing ${missingFields.join(', ')}`,
    };
  }

  const workflowName = workflow.name;

  try {
    let result: N8nWorkflowDetail;
    let action: 'created' | 'updated' | 'skipped';

    if (opts.mode === 'create') {
      // 새로 생성 - ID 제거하고 생성
      const { id, createdAt, updatedAt, ...workflowData } = workflow;
      result = await client.createWorkflow(workflowData);
      action = 'created';
    } else if (opts.mode === 'update') {
      // 기존 업데이트 - ID 필수
      if (!workflow.id) {
        return {
          workflowId: '',
          workflowName,
          action: 'skipped',
          success: false,
          error: 'Update mode requires workflow ID in JSON file',
        };
      }
      const { createdAt, updatedAt, ...workflowData } = workflow;
      result = await client.updateWorkflow(workflow.id, workflowData);
      action = 'updated';
    } else {
      // upsert: 이름으로 검색하여 있으면 update, 없으면 create
      const existing = await findWorkflowByName(client, workflowName);
      if (existing) {
        const { id, createdAt, updatedAt, ...workflowData } = workflow;
        result = await client.updateWorkflow(existing.id, workflowData);
        action = 'updated';
      } else {
        const { id, createdAt, updatedAt, ...workflowData } = workflow;
        result = await client.createWorkflow(workflowData);
        action = 'created';
      }
    }

    // 활성화 옵션 처리
    if (opts.activate && result.id) {
      await client.activateWorkflow(result.id);
    }

    return {
      workflowId: result.id,
      workflowName: result.name,
      action,
      success: true,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return {
      workflowId: workflow.id || '',
      workflowName,
      action: 'skipped',
      success: false,
      error: msg,
    };
  }
}
