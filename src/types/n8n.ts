/**
 * n8n API 타입 정의
 * @description n8n REST API와 통신하기 위한 타입 정의
 */

/**
 * n8n Tag 정보
 */
export interface N8nTag {
  id: string;
  name: string;
}

/**
 * n8n Workflow 기본 정보
 */
export interface N8nWorkflow {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  tags?: N8nTag[];
}

/**
 * n8n Node 정보
 */
export interface N8nNode {
  id: string;
  name: string;
  type: string;
  typeVersion: number;
  position: [number, number];
  parameters: Record<string, unknown>;
  credentials?: Record<string, unknown>;
  disabled?: boolean;
}

/**
 * n8n Workflow 상세 정보 (노드 포함)
 */
export interface N8nWorkflowDetail extends N8nWorkflow {
  nodes: N8nNode[];
  connections: Record<string, unknown>;
  settings?: Record<string, unknown>;
  staticData?: unknown;
  pinData?: Record<string, unknown>;
}

/**
 * n8n Execution 상태
 */
export type N8nExecutionStatus = 'success' | 'error' | 'running' | 'waiting' | 'canceled' | 'unknown';

/**
 * n8n Execution 모드
 */
export type N8nExecutionMode = 'manual' | 'trigger' | 'webhook' | 'cli' | 'integrated' | 'internal';

/**
 * n8n Execution 정보
 */
export interface N8nExecution {
  id: string;
  workflowId: string;
  finished: boolean;
  mode: N8nExecutionMode;
  startedAt: string;
  stoppedAt?: string;
  status: N8nExecutionStatus;
  data?: {
    resultData?: unknown;
  };
}

/**
 * n8n API 응답 래퍼
 */
export interface N8nApiResponse<T> {
  data: T;
}

/**
 * n8n 워크플로우 목록 응답
 */
export interface N8nWorkflowListResponse {
  data: N8nWorkflow[];
  nextCursor?: string;
}

/**
 * n8n 실행 목록 응답
 */
export interface N8nExecutionListResponse {
  data: N8nExecution[];
  nextCursor?: string;
}

/**
 * n8n Health Check 응답
 */
export interface N8nHealthResponse {
  status: 'ok';
}

/**
 * n8n Credential 정보 (민감 정보 제외)
 */
export interface N8nCredential {
  id: string;
  name: string;
  type: string;
  createdAt: string;
  updatedAt: string;
}
