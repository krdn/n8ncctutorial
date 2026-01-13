/**
 * 워크플로우 비교(Diff) 모듈
 * @description 워크플로우 버전 간 차이점 비교 기능
 * @note 이 파일은 stub 구현입니다. 06-03에서 완전 구현 예정
 */

import * as fs from 'fs';
import * as path from 'path';
import { simpleGit } from 'simple-git';
import type { WorkflowDiff, NodeDiff, ConnectionDiff } from './types.js';

/**
 * 워크플로우 JSON 파일 읽기
 * @param filePath - 워크플로우 JSON 파일의 절대 경로
 * @returns 파싱된 워크플로우 객체 또는 null
 */
export function readWorkflowFile(filePath: string): Record<string, unknown> | null {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * 특정 커밋에서 워크플로우 파일 내용 가져오기
 * @param repoPath - Git 저장소 경로
 * @param filePath - 워크플로우 파일 상대 경로
 * @param commitHash - 커밋 해시 (또는 'HEAD')
 * @returns 해당 커밋 시점의 워크플로우 객체 또는 null
 */
export async function getWorkflowAtCommit(
  repoPath: string,
  filePath: string,
  commitHash: string
): Promise<Record<string, unknown> | null> {
  try {
    const git = simpleGit(repoPath);
    const content = await git.show([`${commitHash}:${filePath}`]);
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * 두 워크플로우 비교
 * @param oldWorkflow - 이전 워크플로우
 * @param newWorkflow - 새 워크플로우
 * @returns 워크플로우 diff 결과
 */
export function compareWorkflows(
  oldWorkflow: Record<string, unknown>,
  newWorkflow: Record<string, unknown>
): WorkflowDiff {
  const workflowId = String(newWorkflow.id || oldWorkflow.id || '');
  const workflowName = String(newWorkflow.name || oldWorkflow.name || 'Unknown');

  const oldNodes = Array.isArray(oldWorkflow.nodes) ? oldWorkflow.nodes : [];
  const newNodes = Array.isArray(newWorkflow.nodes) ? newWorkflow.nodes : [];

  const oldNodeIds = new Set(oldNodes.map((n: { id?: string }) => n.id));
  const newNodeIds = new Set(newNodes.map((n: { id?: string }) => n.id));

  const nodes: NodeDiff[] = [];

  // 추가된 노드
  for (const node of newNodes) {
    const n = node as { id?: string; name?: string; type?: string };
    if (!oldNodeIds.has(n.id)) {
      nodes.push({
        nodeId: String(n.id || ''),
        nodeName: String(n.name || ''),
        nodeType: String(n.type || ''),
        changeType: 'added',
      });
    }
  }

  // 삭제된 노드
  for (const node of oldNodes) {
    const n = node as { id?: string; name?: string; type?: string };
    if (!newNodeIds.has(n.id)) {
      nodes.push({
        nodeId: String(n.id || ''),
        nodeName: String(n.name || ''),
        nodeType: String(n.type || ''),
        changeType: 'removed',
      });
    }
  }

  // 수정된 노드 (간단한 비교)
  for (const newNode of newNodes) {
    const nn = newNode as { id?: string; name?: string; type?: string };
    if (oldNodeIds.has(nn.id)) {
      const oldNode = oldNodes.find((n: { id?: string }) => n.id === nn.id);
      if (oldNode && JSON.stringify(oldNode) !== JSON.stringify(newNode)) {
        nodes.push({
          nodeId: String(nn.id || ''),
          nodeName: String(nn.name || ''),
          nodeType: String(nn.type || ''),
          changeType: 'modified',
        });
      }
    }
  }

  // 연결 변경 (간단 구현)
  const connections: ConnectionDiff[] = [];
  const settingsChanged =
    JSON.stringify(oldWorkflow.settings) !== JSON.stringify(newWorkflow.settings);

  return {
    workflowId,
    workflowName,
    nodes,
    connections,
    settingsChanged,
    summary: {
      nodesAdded: nodes.filter((n) => n.changeType === 'added').length,
      nodesRemoved: nodes.filter((n) => n.changeType === 'removed').length,
      nodesModified: nodes.filter((n) => n.changeType === 'modified').length,
      connectionsAdded: connections.filter((c) => c.changeType === 'added').length,
      connectionsRemoved: connections.filter((c) => c.changeType === 'removed').length,
    },
  };
}

/**
 * Diff 결과를 사람이 읽기 쉬운 형식으로 포맷팅
 * @param diff - 워크플로우 diff 결과
 * @param options - 포맷팅 옵션
 * @returns 포맷팅된 문자열
 */
export function formatDiff(
  diff: WorkflowDiff,
  options?: { verbose?: boolean }
): string {
  const lines: string[] = [];

  lines.push(`Workflow: ${diff.workflowName} (${diff.workflowId})`);
  lines.push('');

  const { summary } = diff;
  const total =
    summary.nodesAdded +
    summary.nodesRemoved +
    summary.nodesModified +
    summary.connectionsAdded +
    summary.connectionsRemoved +
    (diff.settingsChanged ? 1 : 0);

  if (total === 0) {
    lines.push('No changes detected.');
  } else {
    lines.push('Summary:');
    if (summary.nodesAdded > 0) lines.push(`  + ${summary.nodesAdded} node(s) added`);
    if (summary.nodesRemoved > 0) lines.push(`  - ${summary.nodesRemoved} node(s) removed`);
    if (summary.nodesModified > 0) lines.push(`  ~ ${summary.nodesModified} node(s) modified`);
    if (summary.connectionsAdded > 0) lines.push(`  + ${summary.connectionsAdded} connection(s) added`);
    if (summary.connectionsRemoved > 0) lines.push(`  - ${summary.connectionsRemoved} connection(s) removed`);
    if (diff.settingsChanged) lines.push('  * Settings changed');

    if (options?.verbose && diff.nodes.length > 0) {
      lines.push('');
      lines.push('Node changes:');
      for (const node of diff.nodes) {
        const symbol = node.changeType === 'added' ? '+' : node.changeType === 'removed' ? '-' : '~';
        lines.push(`  ${symbol} ${node.nodeName} (${node.nodeType})`);
      }
    }
  }

  return lines.join('\n');
}

/**
 * Diff 결과를 JSON 형식으로 포맷팅
 * @param diff - 워크플로우 diff 결과
 * @returns JSON 문자열
 */
export function formatDiffAsJson(diff: WorkflowDiff): string {
  return JSON.stringify(diff, null, 2);
}
