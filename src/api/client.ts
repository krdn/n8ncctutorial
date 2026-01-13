/**
 * n8n API 클라이언트
 * @description n8n REST API와 통신하는 HTTP 클라이언트
 */

import type {
  N8nWorkflow,
  N8nWorkflowDetail,
  N8nWorkflowListResponse,
  N8nExecution,
  N8nExecutionListResponse,
  N8nCredential,
} from '../types/n8n.js';

/**
 * n8n API 에러 클래스
 */
export class N8nApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly response?: unknown
  ) {
    super(message);
    this.name = 'N8nApiError';
  }
}

/**
 * API 요청 옵션
 */
interface RequestOptions extends Omit<RequestInit, 'headers'> {
  headers?: Record<string, string>;
  timeout?: number;
}

/**
 * n8n REST API 클라이언트
 */
export class N8nApiClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly defaultTimeout: number;

  /**
   * N8nApiClient 생성
   * @param baseUrl - n8n 인스턴스 URL (예: http://localhost:5678)
   * @param apiKey - n8n API Key
   * @param defaultTimeout - 기본 타임아웃 (ms), 기본값 30초
   */
  constructor(baseUrl: string, apiKey: string, defaultTimeout = 30000) {
    // URL 끝의 슬래시 제거
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.apiKey = apiKey;
    this.defaultTimeout = defaultTimeout;
  }

  /**
   * HTTP 요청 실행
   * @param path - API 경로
   * @param options - 요청 옵션
   * @returns 응답 데이터
   */
  private async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const url = `${this.baseUrl}/api/v1${path}`;
    const timeout = options.timeout ?? this.defaultTimeout;

    // AbortController로 타임아웃 처리
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'X-N8N-API-KEY': this.apiKey,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...options.headers,
        },
      });

      clearTimeout(timeoutId);

      // 응답 본문 읽기
      let body: unknown;
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        body = await response.json();
      } else {
        body = await response.text();
      }

      // 에러 응답 처리
      if (!response.ok) {
        const message = this.extractErrorMessage(body, response.statusText);
        throw new N8nApiError(message, response.status, body);
      }

      return body as T;
    } catch (error) {
      clearTimeout(timeoutId);

      // AbortError (타임아웃)
      if (error instanceof Error && error.name === 'AbortError') {
        throw new N8nApiError(`요청 타임아웃 (${timeout}ms)`, 0);
      }

      // N8nApiError는 그대로 전달
      if (error instanceof N8nApiError) {
        throw error;
      }

      // 네트워크 에러 등
      const message = error instanceof Error ? error.message : String(error);
      throw new N8nApiError(`요청 실패: ${message}`, 0);
    }
  }

  /**
   * 에러 메시지 추출
   */
  private extractErrorMessage(body: unknown, fallback: string): string {
    if (typeof body === 'object' && body !== null) {
      const obj = body as Record<string, unknown>;
      if (typeof obj.message === 'string') return obj.message;
      if (typeof obj.error === 'string') return obj.error;
    }
    if (typeof body === 'string' && body.length > 0) return body;
    return fallback;
  }

  /**
   * Health Check - n8n 인스턴스 연결 확인
   * @returns 연결 성공 여부
   */
  async healthCheck(): Promise<boolean> {
    try {
      // n8n API의 health 엔드포인트 호출
      // n8n은 /healthz 또는 / 엔드포인트로 상태 확인 가능
      const url = `${this.baseUrl}/healthz`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(url, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch {
      // /healthz가 없으면 workflows API로 확인
      try {
        await this.getWorkflows(1);
        return true;
      } catch {
        return false;
      }
    }
  }

  /**
   * 워크플로우 목록 조회
   * @param limit - 조회할 개수 (기본 100)
   * @param cursor - 페이지네이션 커서
   * @returns 워크플로우 목록
   */
  async getWorkflows(limit = 100, cursor?: string): Promise<N8nWorkflow[]> {
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    if (cursor) {
      params.set('cursor', cursor);
    }

    const response = await this.request<N8nWorkflowListResponse>(
      `/workflows?${params.toString()}`
    );

    return response.data;
  }

  /**
   * 모든 워크플로우 조회 (페이지네이션 자동 처리)
   * @returns 전체 워크플로우 목록
   */
  async getAllWorkflows(): Promise<N8nWorkflow[]> {
    const workflows: N8nWorkflow[] = [];
    let cursor: string | undefined;

    do {
      const params = new URLSearchParams();
      params.set('limit', '100');
      if (cursor) {
        params.set('cursor', cursor);
      }

      const response = await this.request<N8nWorkflowListResponse>(
        `/workflows?${params.toString()}`
      );

      workflows.push(...response.data);
      cursor = response.nextCursor;
    } while (cursor);

    return workflows;
  }

  /**
   * 워크플로우 상세 조회
   * @param id - 워크플로우 ID
   * @returns 워크플로우 상세 정보
   */
  async getWorkflow(id: string): Promise<N8nWorkflowDetail> {
    return this.request<N8nWorkflowDetail>(`/workflows/${id}`);
  }

  /**
   * 워크플로우 생성
   * @param workflow - 워크플로우 데이터
   * @returns 생성된 워크플로우
   */
  async createWorkflow(workflow: Partial<N8nWorkflowDetail>): Promise<N8nWorkflowDetail> {
    return this.request<N8nWorkflowDetail>('/workflows', {
      method: 'POST',
      body: JSON.stringify(workflow),
    });
  }

  /**
   * 워크플로우 업데이트
   * @param id - 워크플로우 ID
   * @param workflow - 업데이트할 데이터
   * @returns 업데이트된 워크플로우
   */
  async updateWorkflow(id: string, workflow: Partial<N8nWorkflowDetail>): Promise<N8nWorkflowDetail> {
    return this.request<N8nWorkflowDetail>(`/workflows/${id}`, {
      method: 'PUT',
      body: JSON.stringify(workflow),
    });
  }

  /**
   * 워크플로우 삭제
   * @param id - 워크플로우 ID
   */
  async deleteWorkflow(id: string): Promise<void> {
    await this.request<unknown>(`/workflows/${id}`, {
      method: 'DELETE',
    });
  }

  /**
   * 워크플로우 활성화
   * @param id - 워크플로우 ID
   * @returns 활성화된 워크플로우
   */
  async activateWorkflow(id: string): Promise<N8nWorkflowDetail> {
    return this.request<N8nWorkflowDetail>(`/workflows/${id}/activate`, {
      method: 'POST',
    });
  }

  /**
   * 워크플로우 비활성화
   * @param id - 워크플로우 ID
   * @returns 비활성화된 워크플로우
   */
  async deactivateWorkflow(id: string): Promise<N8nWorkflowDetail> {
    return this.request<N8nWorkflowDetail>(`/workflows/${id}/deactivate`, {
      method: 'POST',
    });
  }

  /**
   * 실행 목록 조회
   * @param workflowId - 워크플로우 ID (선택)
   * @param limit - 조회할 개수 (기본 100)
   * @returns 실행 목록
   */
  async getExecutions(workflowId?: string, limit = 100): Promise<N8nExecution[]> {
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    if (workflowId) {
      params.set('workflowId', workflowId);
    }

    const response = await this.request<N8nExecutionListResponse>(
      `/executions?${params.toString()}`
    );

    return response.data;
  }

  /**
   * 실행 상세 조회
   * @param id - 실행 ID
   * @returns 실행 상세 정보
   */
  async getExecution(id: string): Promise<N8nExecution> {
    return this.request<N8nExecution>(`/executions/${id}`);
  }

  /**
   * Credentials 목록 조회
   * @returns Credential 목록
   */
  async getCredentials(): Promise<N8nCredential[]> {
    const response = await this.request<{ data: N8nCredential[] }>('/credentials');
    return response.data;
  }
}
