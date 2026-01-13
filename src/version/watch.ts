/**
 * 워크플로우 변경 감지 모듈
 * @description Git status 기반 워크플로우 파일 변경 감지 기능
 */

import * as fs from 'fs';
import * as path from 'path';
import { getRepoStatus } from './git.js';
import type {
  ChangeType,
  WorkflowChange,
  ChangeDetectionResult,
  WorkflowSummary,
} from './types.js';

/** 매니페스트 파일명 (제외 대상) */
const MANIFEST_FILENAME = 'manifest.json';

/**
 * 파일 경로가 워크플로우 JSON인지 확인
 * @param filePath - 확인할 파일 경로
 * @returns 워크플로우 JSON 여부
 */
function isWorkflowJsonFile(filePath: string): boolean {
  // .json 확장자 확인
  if (!filePath.toLowerCase().endsWith('.json')) {
    return false;
  }

  // manifest.json 제외
  const fileName = path.basename(filePath).toLowerCase();
  if (fileName === MANIFEST_FILENAME.toLowerCase()) {
    return false;
  }

  return true;
}

/**
 * 파일 경로 정규화
 * @description 대소문자 구분 문제 방지를 위한 경로 정규화
 * @param filePath - 정규화할 파일 경로
 * @returns 정규화된 파일 경로
 */
function normalizePath(filePath: string): string {
  return path.normalize(filePath).replace(/\\/g, '/');
}

/**
 * 워크플로우 JSON 파일 읽기 및 파싱
 * @description 파일 존재 여부 확인 후 JSON 파싱
 * @param filePath - 워크플로우 JSON 파일의 절대 경로
 * @returns 파싱된 워크플로우 객체 또는 null (파일 없음/파싱 실패)
 */
export async function parseWorkflowFromFile(
  filePath: string
): Promise<Record<string, unknown> | null> {
  try {
    // 파일 존재 여부 확인
    if (!fs.existsSync(filePath)) {
      return null;
    }

    // 파일 읽기 및 파싱
    const content = fs.readFileSync(filePath, 'utf-8');
    const workflow = JSON.parse(content) as Record<string, unknown>;

    // 기본 검증: id 또는 name 필드 존재 확인
    if (!workflow.id && !workflow.name) {
      return null;
    }

    return workflow;
  } catch {
    // 파싱 실패 시 null 반환
    return null;
  }
}

/**
 * 워크플로우 요약 정보 추출
 * @description 워크플로우 객체에서 주요 정보만 추출
 * @param workflow - 워크플로우 객체 (JSON 파싱 결과)
 * @returns 워크플로우 요약 정보
 */
export function getWorkflowSummary(
  workflow: Record<string, unknown>
): WorkflowSummary {
  // nodes 배열에서 노드 개수 계산
  const nodes = Array.isArray(workflow.nodes) ? workflow.nodes : [];

  // tags 처리 - 문자열 배열 또는 객체 배열 (n8n 형식)
  let tags: string[] | undefined;
  if (Array.isArray(workflow.tags)) {
    tags = workflow.tags.map((tag: unknown) => {
      if (typeof tag === 'string') return tag;
      if (typeof tag === 'object' && tag !== null && 'name' in tag) {
        return String((tag as { name: unknown }).name);
      }
      return String(tag);
    });
  }

  return {
    id: String(workflow.id || ''),
    name: String(workflow.name || 'Unnamed Workflow'),
    nodeCount: nodes.length,
    active: Boolean(workflow.active),
    tags,
  };
}

/**
 * 파일 경로에서 워크플로우 정보 추출
 * @description 파일을 읽어 워크플로우 ID와 이름 반환
 * @param repoPath - 저장소 루트 경로
 * @param relativePath - 상대 파일 경로
 * @returns 워크플로우 ID와 이름
 */
async function extractWorkflowInfo(
  repoPath: string,
  relativePath: string
): Promise<{ id: string; name: string }> {
  const absolutePath = path.join(repoPath, relativePath);
  const workflow = await parseWorkflowFromFile(absolutePath);

  if (workflow) {
    return {
      id: String(workflow.id || ''),
      name: String(workflow.name || 'Unknown'),
    };
  }

  // 파일 읽기 실패 시 파일명에서 추출 시도
  const fileName = path.basename(relativePath, '.json');
  return {
    id: fileName,
    name: fileName,
  };
}

/**
 * Git status 기반 변경 감지
 * @description 저장소의 modified, untracked, deleted 파일에서 워크플로우 변경 감지
 * @param repoPath - Git 저장소 경로
 * @returns 변경 감지 결과
 */
export async function detectChanges(
  repoPath: string
): Promise<ChangeDetectionResult> {
  const timestamp = new Date().toISOString();
  const changes: WorkflowChange[] = [];

  // Git 상태 조회
  const status = await getRepoStatus(repoPath);

  // Git 저장소가 아닌 경우
  if (!status.isRepo) {
    return {
      changes: [],
      hasChanges: false,
      timestamp,
    };
  }

  // 수정된 파일 처리 (modified)
  for (const filePath of status.modified) {
    const normalizedPath = normalizePath(filePath);
    if (!isWorkflowJsonFile(normalizedPath)) continue;

    const { id, name } = await extractWorkflowInfo(repoPath, normalizedPath);
    changes.push({
      workflowId: id,
      workflowName: name,
      filePath: normalizedPath,
      changeType: 'modified' as ChangeType,
    });
  }

  // 새로 추가된 파일 처리 (untracked)
  for (const filePath of status.untracked) {
    const normalizedPath = normalizePath(filePath);
    if (!isWorkflowJsonFile(normalizedPath)) continue;

    const { id, name } = await extractWorkflowInfo(repoPath, normalizedPath);
    changes.push({
      workflowId: id,
      workflowName: name,
      filePath: normalizedPath,
      changeType: 'added' as ChangeType,
    });
  }

  // 스테이징된 파일도 확인 (staged)
  for (const filePath of status.staged) {
    const normalizedPath = normalizePath(filePath);
    if (!isWorkflowJsonFile(normalizedPath)) continue;

    // 이미 처리된 파일인지 확인
    const alreadyProcessed = changes.some(
      (c) => c.filePath === normalizedPath
    );
    if (alreadyProcessed) continue;

    const { id, name } = await extractWorkflowInfo(repoPath, normalizedPath);

    // 파일 존재 여부로 added/modified 판단
    const absolutePath = path.join(repoPath, normalizedPath);
    const changeType: ChangeType = fs.existsSync(absolutePath)
      ? 'modified'
      : 'deleted';

    changes.push({
      workflowId: id,
      workflowName: name,
      filePath: normalizedPath,
      changeType,
    });
  }

  return {
    changes,
    hasChanges: changes.length > 0,
    timestamp,
  };
}
