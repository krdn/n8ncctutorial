/**
 * 환경 관리 유틸리티 모듈
 * @description 환경 목록 조회, 검색, 검증 등 환경 관련 유틸리티 함수
 */

import type { Config, EnvironmentConfig, EnvironmentSummary } from '../types/config.js';

/**
 * 모든 환경 요약 목록 반환
 * @param config - 전체 설정 객체
 * @returns 환경 요약 정보 배열
 */
export function listEnvironments(config: Config): EnvironmentSummary[] {
  return config.environments.map((env) => ({
    name: env.name,
    url: env.n8n.url,
    isDefault: env.isDefault ?? false,
    description: env.description,
    isCurrent: env.name === config.currentEnvironment,
  }));
}

/**
 * 환경 존재 여부 확인
 * @param config - 전체 설정 객체
 * @param name - 확인할 환경 이름
 * @returns 환경 존재 여부
 */
export function hasEnvironment(config: Config, name: string): boolean {
  return config.environments.some((env) => env.name === name);
}

/**
 * 기본 환경 설정 가져오기
 * @param config - 전체 설정 객체
 * @returns 기본 환경 설정 또는 null
 */
export function getDefaultEnvironment(config: Config): EnvironmentConfig | null {
  return config.environments.find((env) => env.isDefault === true) ?? null;
}

/**
 * 환경 이름 목록만 반환
 * @param config - 전체 설정 객체
 * @returns 환경 이름 배열
 */
export function getEnvironmentNames(config: Config): string[] {
  return config.environments.map((env) => env.name);
}

/**
 * 현재 활성 환경인지 확인
 * @param config - 전체 설정 객체
 * @param name - 확인할 환경 이름
 * @returns 현재 활성 환경 여부
 */
export function isCurrentEnvironment(config: Config, name: string): boolean {
  return config.currentEnvironment === name;
}
