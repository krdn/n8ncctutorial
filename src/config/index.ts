/**
 * 설정 로더 모듈
 * @description YAML 설정 파일을 로드하고 검증하는 기능 제공
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { parse } from 'yaml';
import type { Config, EnvironmentConfig } from '../types/config.js';
import { validateConfig, applyDefaults } from './schema.js';

/**
 * 설정 파일의 기본 검색 경로들
 */
const CONFIG_PATHS = [
  './n8n-wfm.config.yaml',
  './n8n-wfm.config.yml',
  path.join(os.homedir(), '.n8n-wfm', 'config.yaml'),
  path.join(os.homedir(), '.n8n-wfm', 'config.yml'),
];

/**
 * 환경변수 참조를 실제 값으로 치환
 * @description ${VAR_NAME} 형태의 문자열을 환경변수 값으로 대체
 * @param value - 치환할 문자열
 * @returns 환경변수가 적용된 문자열
 */
function substituteEnvVars(value: string): string {
  return value.replace(/\$\{([^}]+)\}/g, (_, varName) => {
    const envValue = process.env[varName];
    if (envValue === undefined) {
      console.warn(`경고: 환경변수 "${varName}"가 설정되지 않았습니다`);
      return '';
    }
    return envValue;
  });
}

/**
 * 객체 내의 모든 문자열에 환경변수 치환 적용
 * @param obj - 치환할 객체
 * @returns 환경변수가 적용된 객체
 */
function substituteEnvVarsDeep<T>(obj: T): T {
  if (typeof obj === 'string') {
    return substituteEnvVars(obj) as T;
  }

  if (Array.isArray(obj)) {
    return obj.map(substituteEnvVarsDeep) as T;
  }

  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = substituteEnvVarsDeep(value);
    }
    return result as T;
  }

  return obj;
}

/**
 * 설정 파일 존재 여부 확인
 * @param configPath - 확인할 경로
 * @returns 파일 존재 여부
 */
export function configExists(configPath?: string): boolean {
  if (configPath) {
    return fs.existsSync(configPath);
  }

  return CONFIG_PATHS.some((p) => fs.existsSync(p));
}

/**
 * 사용 가능한 설정 파일 경로 찾기
 * @param configPath - 사용자 지정 경로 (선택)
 * @returns 찾은 설정 파일 경로 또는 null
 */
export function findConfigPath(configPath?: string): string | null {
  if (configPath) {
    return fs.existsSync(configPath) ? configPath : null;
  }

  for (const p of CONFIG_PATHS) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  return null;
}

/**
 * 설정 파일 로드
 * @param configPath - 설정 파일 경로 (선택, 없으면 기본 경로에서 검색)
 * @returns 로드된 설정 객체
 * @throws 파일이 없거나 유효하지 않은 경우 에러
 */
export function loadConfig(configPath?: string): Config {
  const foundPath = findConfigPath(configPath);

  if (!foundPath) {
    const searchedPaths = configPath ? [configPath] : CONFIG_PATHS;
    throw new Error(
      `설정 파일을 찾을 수 없습니다.\n\n` +
        `검색한 경로:\n${searchedPaths.map((p) => `  - ${p}`).join('\n')}\n\n` +
        `설정 파일을 생성하려면:\n` +
        `  1. config.example.yaml을 n8n-wfm.config.yaml로 복사\n` +
        `  2. 필요한 값을 설정\n` +
        `  3. 환경변수 설정 (예: export N8N_DEV_API_KEY=your-key)`
    );
  }

  // 파일 읽기
  const content = fs.readFileSync(foundPath, 'utf-8');

  // YAML 파싱
  let parsed: unknown;
  try {
    parsed = parse(content);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(`YAML 파싱 실패 (${foundPath}): ${msg}`);
  }

  // 검증
  const validation = validateConfig(parsed);
  if (!validation.valid) {
    throw new Error(
      `설정 파일 검증 실패 (${foundPath}):\n${validation.errors.map((e) => `  - ${e}`).join('\n')}`
    );
  }

  // 환경변수 치환 및 기본값 적용
  const substituted = substituteEnvVarsDeep(parsed as Config);
  const config = applyDefaults(substituted);

  return config;
}

/**
 * 현재 활성 환경 설정 가져오기
 * @param config - 전체 설정 객체
 * @returns 현재 환경 설정
 * @throws 현재 환경이 없는 경우 에러
 */
export function getCurrentEnvironment(config: Config): EnvironmentConfig {
  const env = config.environments.find((e) => e.name === config.currentEnvironment);

  if (!env) {
    throw new Error(`환경 "${config.currentEnvironment}"를 찾을 수 없습니다`);
  }

  return env;
}

/**
 * 특정 이름의 환경 설정 가져오기
 * @param config - 전체 설정 객체
 * @param envName - 환경 이름
 * @returns 환경 설정
 * @throws 환경이 없는 경우 에러
 */
export function getEnvironment(config: Config, envName: string): EnvironmentConfig {
  const env = config.environments.find((e) => e.name === envName);

  if (!env) {
    const available = config.environments.map((e) => e.name).join(', ');
    throw new Error(`환경 "${envName}"를 찾을 수 없습니다. 사용 가능: ${available}`);
  }

  return env;
}

// 모듈 재내보내기
export { validateConfig, applyDefaults } from './schema.js';
export type { ValidationResult } from './schema.js';
