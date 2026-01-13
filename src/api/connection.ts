/**
 * n8n 연결 관리 모듈
 * @description n8n 인스턴스 연결 테스트 및 관리 기능
 */

import { loadConfig, getCurrentEnvironment, getEnvironment, configExists } from '../config/index.js';
import { N8nApiClient, N8nApiError } from './client.js';
import { createClient } from './index.js';

/**
 * 연결 상태 정보
 */
export interface ConnectionStatus {
  /** 연결 성공 여부 */
  connected: boolean;
  /** 환경 이름 */
  environment: string;
  /** n8n 인스턴스 URL */
  url: string;
  /** n8n 버전 (연결 성공 시) */
  version?: string;
  /** 에러 메시지 (연결 실패 시) */
  error?: string;
  /** 응답 지연 시간 (ms) */
  latencyMs?: number;
}

/**
 * 연결 테스트 결과
 */
export interface ConnectionTestResult {
  /** 테스트 성공 여부 */
  success: boolean;
  /** 연결 상태 정보 */
  status: ConnectionStatus;
}

/**
 * 연결 테스트 수행
 * @param client - N8nApiClient 인스턴스
 * @param envName - 환경 이름
 * @param url - n8n 인스턴스 URL
 * @returns 연결 테스트 결과
 */
export async function testConnection(
  client: N8nApiClient,
  envName: string,
  url: string
): Promise<ConnectionTestResult> {
  const startTime = Date.now();

  try {
    const connected = await client.healthCheck();
    const latencyMs = Date.now() - startTime;

    if (connected) {
      return {
        success: true,
        status: {
          connected: true,
          environment: envName,
          url,
          latencyMs,
        },
      };
    } else {
      return {
        success: false,
        status: {
          connected: false,
          environment: envName,
          url,
          error: '연결 실패: Health check 응답 없음',
          latencyMs,
        },
      };
    }
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    let errorMessage: string;

    if (error instanceof N8nApiError) {
      if (error.statusCode === 401) {
        errorMessage = '인증 실패: API Key를 확인하세요';
      } else if (error.statusCode === 403) {
        errorMessage = '접근 거부: API 권한을 확인하세요';
      } else if (error.statusCode === 0) {
        errorMessage = error.message;
      } else {
        errorMessage = `HTTP ${error.statusCode}: ${error.message}`;
      }
    } else if (error instanceof Error) {
      if (error.message.includes('ECONNREFUSED')) {
        errorMessage = '연결 거부: n8n 서버가 실행 중인지 확인하세요';
      } else if (error.message.includes('ENOTFOUND')) {
        errorMessage = '호스트를 찾을 수 없음: URL을 확인하세요';
      } else if (error.message.includes('ETIMEDOUT')) {
        errorMessage = '연결 시간 초과';
      } else {
        errorMessage = error.message;
      }
    } else {
      errorMessage = String(error);
    }

    return {
      success: false,
      status: {
        connected: false,
        environment: envName,
        url,
        error: errorMessage,
        latencyMs,
      },
    };
  }
}

/**
 * 설정에서 환경에 연결 테스트
 * @param envName - 환경 이름 (없으면 currentEnvironment 사용)
 * @param configPath - 설정 파일 경로 (선택)
 * @returns 연결 테스트 결과
 * @throws 설정 파일이 없거나 환경을 찾을 수 없는 경우
 */
export async function connectToEnvironment(
  envName?: string,
  configPath?: string
): Promise<ConnectionTestResult> {
  // 설정 파일 존재 확인
  if (!configExists(configPath)) {
    return {
      success: false,
      status: {
        connected: false,
        environment: envName || 'unknown',
        url: 'unknown',
        error: '설정 파일을 찾을 수 없습니다. config.example.yaml을 복사하여 설정하세요.',
      },
    };
  }

  // 설정 로드
  const config = loadConfig(configPath);

  // 환경 가져오기
  const env = envName
    ? getEnvironment(config, envName)
    : getCurrentEnvironment(config);

  // 클라이언트 생성
  const client = createClient(env);

  // 연결 테스트
  return testConnection(client, env.name, env.n8n.url);
}

/**
 * 여러 환경에 동시 연결 테스트
 * @param configPath - 설정 파일 경로 (선택)
 * @returns 모든 환경의 연결 테스트 결과
 */
export async function testAllEnvironments(
  configPath?: string
): Promise<ConnectionTestResult[]> {
  if (!configExists(configPath)) {
    return [];
  }

  const config = loadConfig(configPath);

  const results = await Promise.all(
    config.environments.map(async (env) => {
      const client = createClient(env);
      return testConnection(client, env.name, env.n8n.url);
    })
  );

  return results;
}
