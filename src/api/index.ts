/**
 * API 모듈 진입점
 * @description n8n API 클라이언트 및 관련 타입 제공
 */

import type { EnvironmentConfig } from '../types/config.js';
import { N8nApiClient } from './client.js';

// 클라이언트 및 에러 클래스 export
export { N8nApiClient, N8nApiError } from './client.js';

// n8n API 타입 export
export type {
  N8nTag,
  N8nWorkflow,
  N8nWorkflowDetail,
  N8nNode,
  N8nExecution,
  N8nExecutionStatus,
  N8nExecutionMode,
  N8nApiResponse,
  N8nWorkflowListResponse,
  N8nExecutionListResponse,
  N8nHealthResponse,
  N8nCredential,
} from '../types/n8n.js';

/**
 * 환경 설정에서 API 클라이언트 생성
 * @param envConfig - 환경 설정
 * @returns n8n API 클라이언트
 */
export function createClient(envConfig: EnvironmentConfig): N8nApiClient {
  return new N8nApiClient(envConfig.n8n.url, envConfig.n8n.apiKey);
}
