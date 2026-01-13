/**
 * Credential 매핑 및 변환 모듈
 * @description 환경별 credential ID 매핑 및 변환 유틸리티
 */

import type {
  Config,
  CredentialMapping,
  CredentialMappingSummary,
  CredentialTransform,
} from '../types/config.js';
import type { ValidationResult } from './schema.js';

/**
 * 이름으로 credential 매핑 검색
 * @param config - 전체 설정 객체
 * @param name - credential 논리적 이름
 * @returns 찾은 매핑 또는 null
 */
export function getCredentialMapping(
  config: Config,
  name: string
): CredentialMapping | null {
  if (!config.credentialMappings) {
    return null;
  }
  return config.credentialMappings.find((m) => m.name === name) ?? null;
}

/**
 * 특정 환경의 credential ID 반환
 * @param config - 전체 설정 객체
 * @param mappingName - credential 논리적 이름
 * @param envName - 환경 이름
 * @returns credential ID 또는 null
 */
export function getCredentialIdForEnv(
  config: Config,
  mappingName: string,
  envName: string
): string | null {
  const mapping = getCredentialMapping(config, mappingName);
  if (!mapping) {
    return null;
  }
  return mapping.environments[envName] ?? null;
}

/**
 * 두 환경 간 전체 credential 변환 맵 생성
 * @description Phase 8 배포 시 credential 자동 변환에 사용
 * @param config - 전체 설정 객체
 * @param sourceEnv - 소스 환경 이름
 * @param targetEnv - 대상 환경 이름
 * @returns credential 변환 정보
 */
export function buildCredentialTransform(
  config: Config,
  sourceEnv: string,
  targetEnv: string
): CredentialTransform {
  const result: CredentialTransform = {
    sourceEnv,
    targetEnv,
    mappings: [],
  };

  if (!config.credentialMappings) {
    return result;
  }

  for (const mapping of config.credentialMappings) {
    const originalId = mapping.environments[sourceEnv];
    const newId = mapping.environments[targetEnv];

    // 양쪽 환경 모두에 ID가 있는 경우만 변환 맵에 포함
    if (originalId && newId) {
      result.mappings.push({
        originalId,
        newId,
        name: mapping.name,
        type: mapping.type,
      });
    }
  }

  return result;
}

/**
 * 모든 credential 매핑 요약 목록 반환
 * @param config - 전체 설정 객체
 * @returns 매핑 요약 정보 배열
 */
export function listCredentialMappings(
  config: Config
): CredentialMappingSummary[] {
  if (!config.credentialMappings) {
    return [];
  }

  // 설정된 모든 환경 이름 가져오기
  const envNames = config.environments.map((env) => env.name);

  return config.credentialMappings.map((mapping) => {
    const environmentStatus: Record<string, boolean> = {};
    for (const envName of envNames) {
      environmentStatus[envName] = !!mapping.environments[envName];
    }
    return {
      name: mapping.name,
      type: mapping.type,
      environmentStatus,
    };
  });
}

/**
 * Credential 매핑 유효성 검증
 * @param config - 전체 설정 객체
 * @returns 검증 결과
 */
export function validateCredentialMappings(config: Config): ValidationResult {
  const errors: string[] = [];

  if (!config.credentialMappings) {
    return { valid: true, errors: [] };
  }

  const envNames = new Set(config.environments.map((env) => env.name));
  const mappingNames = new Set<string>();

  for (const mapping of config.credentialMappings) {
    // 매핑 이름 유효성
    if (!mapping.name || typeof mapping.name !== 'string') {
      errors.push('credentialMapping: name이 필요합니다');
      continue;
    }

    // 이름 중복 체크
    if (mappingNames.has(mapping.name)) {
      errors.push(`credentialMapping: 중복된 이름 "${mapping.name}"`);
    }
    mappingNames.add(mapping.name);

    // 타입 유효성
    if (!mapping.type || typeof mapping.type !== 'string') {
      errors.push(`credentialMapping "${mapping.name}": type이 필요합니다`);
    }

    // environments 유효성
    if (!mapping.environments || typeof mapping.environments !== 'object') {
      errors.push(`credentialMapping "${mapping.name}": environments가 필요합니다`);
      continue;
    }

    // 각 환경 이름이 실제 환경과 일치하는지 확인
    for (const envName of Object.keys(mapping.environments)) {
      if (!envNames.has(envName)) {
        errors.push(
          `credentialMapping "${mapping.name}": 환경 "${envName}"가 environments에 정의되지 않았습니다`
        );
      }
    }

    // 최소 하나의 환경에 ID가 있는지 확인
    const hasAtLeastOneId = Object.values(mapping.environments).some(
      (id) => id && typeof id === 'string'
    );
    if (!hasAtLeastOneId) {
      errors.push(
        `credentialMapping "${mapping.name}": 최소 하나의 환경에 credential ID가 필요합니다`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
