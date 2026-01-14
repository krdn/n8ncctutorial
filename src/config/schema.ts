/**
 * 설정 검증 스키마 모듈
 * @description 설정 파일의 유효성을 검증하는 함수들
 */

import type { Config, CredentialMapping, EnvironmentConfig, N8nInstanceConfig } from '../types/config.js';

/**
 * 설정 검증 결과
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * n8n 인스턴스 설정 검증
 * @param config - n8n 인스턴스 설정
 * @param envName - 환경 이름 (에러 메시지용)
 * @returns 검증 결과
 */
function validateN8nConfig(config: unknown, envName: string): string[] {
  const errors: string[] = [];
  const n8n = config as N8nInstanceConfig;

  if (!n8n || typeof n8n !== 'object') {
    errors.push(`환경 "${envName}": n8n 설정이 필요합니다`);
    return errors;
  }

  if (!n8n.url || typeof n8n.url !== 'string') {
    errors.push(`환경 "${envName}": n8n.url이 필요합니다`);
  } else if (!n8n.url.startsWith('http://') && !n8n.url.startsWith('https://')) {
    errors.push(`환경 "${envName}": n8n.url은 http:// 또는 https://로 시작해야 합니다`);
  }

  if (!n8n.apiKey || typeof n8n.apiKey !== 'string') {
    errors.push(`환경 "${envName}": n8n.apiKey가 필요합니다`);
  }

  return errors;
}

/**
 * 환경 설정 검증
 * @param env - 환경 설정
 * @param index - 환경 인덱스 (에러 메시지용)
 * @returns 검증 결과
 */
/**
 * credential 매핑 검증
 * @param mapping - credential 매핑
 * @param index - 매핑 인덱스 (에러 메시지용)
 * @param envNames - 설정된 환경 이름들
 * @returns 오류 메시지 배열
 */
function validateCredentialMapping(
  mapping: unknown,
  index: number,
  envNames: Set<string>
): string[] {
  const errors: string[] = [];
  const m = mapping as CredentialMapping;

  if (!m || typeof m !== 'object') {
    errors.push(`credentialMappings[${index}]: 유효하지 않은 매핑입니다`);
    return errors;
  }

  if (!m.name || typeof m.name !== 'string') {
    errors.push(`credentialMappings[${index}]: name이 필요합니다`);
    return errors;
  }

  if (!m.type || typeof m.type !== 'string') {
    errors.push(`credentialMappings "${m.name}": type이 필요합니다`);
  }

  if (!m.environments || typeof m.environments !== 'object') {
    errors.push(`credentialMappings "${m.name}": environments가 필요합니다`);
  } else {
    // 환경 이름이 실제 환경과 일치하는지 확인
    for (const envName of Object.keys(m.environments)) {
      if (!envNames.has(envName)) {
        errors.push(
          `credentialMappings "${m.name}": 환경 "${envName}"가 environments에 정의되지 않았습니다`
        );
      }
    }
  }

  return errors;
}

function validateEnvironment(env: unknown, index: number): string[] {
  const errors: string[] = [];
  const environment = env as EnvironmentConfig;

  if (!environment || typeof environment !== 'object') {
    errors.push(`환경 [${index}]: 유효하지 않은 환경 설정입니다`);
    return errors;
  }

  if (!environment.name || typeof environment.name !== 'string') {
    errors.push(`환경 [${index}]: name이 필요합니다`);
    return errors;
  }

  // n8n 설정 검증
  errors.push(...validateN8nConfig(environment.n8n, environment.name));

  return errors;
}

/**
 * 전체 설정 검증
 * @param config - 파싱된 설정 객체
 * @returns 검증 결과
 */
export function validateConfig(config: unknown): ValidationResult {
  const errors: string[] = [];

  if (!config || typeof config !== 'object') {
    return { valid: false, errors: ['설정 파일이 비어있거나 유효하지 않습니다'] };
  }

  const cfg = config as Config;

  // version 검증
  if (!cfg.version || typeof cfg.version !== 'string') {
    errors.push('version 필드가 필요합니다');
  }

  // currentEnvironment 검증
  if (!cfg.currentEnvironment || typeof cfg.currentEnvironment !== 'string') {
    errors.push('currentEnvironment 필드가 필요합니다');
  }

  // environments 검증
  if (!cfg.environments || !Array.isArray(cfg.environments)) {
    errors.push('environments 배열이 필요합니다');
  } else if (cfg.environments.length === 0) {
    errors.push('최소 하나의 환경 설정이 필요합니다');
  } else {
    // 각 환경 검증
    cfg.environments.forEach((env, index) => {
      errors.push(...validateEnvironment(env, index));
    });

    // 환경 이름 중복 체크
    const names = cfg.environments.map((e) => (e as EnvironmentConfig).name).filter(Boolean);
    const duplicates = names.filter((name, idx) => names.indexOf(name) !== idx);
    if (duplicates.length > 0) {
      errors.push(`중복된 환경 이름: ${[...new Set(duplicates)].join(', ')}`);
    }

    // currentEnvironment가 실제로 존재하는지 확인
    if (cfg.currentEnvironment && !names.includes(cfg.currentEnvironment)) {
      errors.push(`currentEnvironment "${cfg.currentEnvironment}"가 environments에 없습니다`);
    }
  }

  // backup 검증 (선택 필드)
  if (cfg.backup !== undefined) {
    if (typeof cfg.backup !== 'object' || cfg.backup === null) {
      errors.push('backup은 객체여야 합니다');
    } else {
      if (!cfg.backup.baseDir || typeof cfg.backup.baseDir !== 'string') {
        errors.push('backup.baseDir가 필요합니다');
      }
      if (typeof cfg.backup.retention !== 'number' || cfg.backup.retention < 1) {
        errors.push('backup.retention은 1 이상의 숫자여야 합니다');
      }
      if (cfg.backup.stripCredentials !== undefined && typeof cfg.backup.stripCredentials !== 'boolean') {
        errors.push('backup.stripCredentials는 boolean이어야 합니다');
      }
    }
  }

  // credentialMappings 검증 (선택 필드)
  if (cfg.credentialMappings !== undefined) {
    if (!Array.isArray(cfg.credentialMappings)) {
      errors.push('credentialMappings는 배열이어야 합니다');
    } else {
      // 환경 이름 세트 생성
      const envNames = new Set(
        cfg.environments?.map((e) => (e as EnvironmentConfig).name).filter(Boolean) ?? []
      );

      // 매핑 이름 중복 체크용 세트
      const mappingNames = new Set<string>();

      cfg.credentialMappings.forEach((mapping, index) => {
        errors.push(...validateCredentialMapping(mapping, index, envNames));

        // 매핑 이름 중복 체크
        const m = mapping as CredentialMapping;
        if (m.name) {
          if (mappingNames.has(m.name)) {
            errors.push(`credentialMappings: 중복된 이름 "${m.name}"`);
          }
          mappingNames.add(m.name);
        }
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 기본값을 적용한 설정 반환
 * @param config - 원본 설정
 * @returns 기본값이 적용된 설정
 */
export function applyDefaults(config: Config): Config {
  return {
    ...config,
    backup: config.backup ?? {
      baseDir: './backups',
      retention: 10,
      stripCredentials: true,
    },
  };
}
