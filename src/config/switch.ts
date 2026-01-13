/**
 * 환경 전환 모듈
 * @description 환경 전환 및 설정 파일 업데이트 기능 제공
 */

import * as fs from 'fs';
import { parse, stringify } from 'yaml';
import type { Config } from '../types/config.js';
import { hasEnvironment, isCurrentEnvironment } from './environment.js';

/**
 * 환경 전환 결과 타입
 */
export interface SwitchResult {
  /** 전환 성공 여부 */
  success: boolean;
  /** 이전 환경 이름 */
  previousEnv: string;
  /** 현재 환경 이름 */
  currentEnv: string;
  /** 에러 메시지 (실패 시) */
  error?: string;
}

/**
 * 환경 전환 검증 결과 타입
 */
export interface SwitchValidationResult {
  /** 전환 가능 여부 */
  valid: boolean;
  /** 대상 환경 존재 여부 */
  targetExists: boolean;
  /** 이미 현재 환경인지 여부 */
  isAlreadyCurrent: boolean;
  /** 검증 메시지 */
  message: string;
}

/**
 * 환경 전환 사전 검증
 * @param config - 전체 설정 객체
 * @param targetEnv - 전환할 대상 환경 이름
 * @returns 검증 결과
 */
export function validateEnvironmentSwitch(
  config: Config,
  targetEnv: string
): SwitchValidationResult {
  // 대상 환경 존재 여부 확인
  const targetExists = hasEnvironment(config, targetEnv);
  if (!targetExists) {
    const availableEnvs = config.environments.map((e) => e.name).join(', ');
    return {
      valid: false,
      targetExists: false,
      isAlreadyCurrent: false,
      message: `환경 "${targetEnv}"를 찾을 수 없습니다. 사용 가능: ${availableEnvs}`,
    };
  }

  // 이미 현재 환경인지 확인
  const isAlreadyCurrent = isCurrentEnvironment(config, targetEnv);
  if (isAlreadyCurrent) {
    return {
      valid: false,
      targetExists: true,
      isAlreadyCurrent: true,
      message: `이미 "${targetEnv}" 환경을 사용 중입니다.`,
    };
  }

  return {
    valid: true,
    targetExists: true,
    isAlreadyCurrent: false,
    message: `환경 "${targetEnv}"로 전환 가능합니다.`,
  };
}

/**
 * 환경 전환
 * @param configPath - 설정 파일 경로
 * @param targetEnv - 전환할 대상 환경 이름
 * @returns 전환 결과
 */
export function switchEnvironment(
  configPath: string,
  targetEnv: string
): SwitchResult {
  try {
    // 설정 파일 읽기
    if (!fs.existsSync(configPath)) {
      return {
        success: false,
        previousEnv: '',
        currentEnv: '',
        error: `설정 파일을 찾을 수 없습니다: ${configPath}`,
      };
    }

    const content = fs.readFileSync(configPath, 'utf-8');
    let config: Config;

    try {
      config = parse(content) as Config;
    } catch (parseError) {
      const msg = parseError instanceof Error ? parseError.message : String(parseError);
      return {
        success: false,
        previousEnv: '',
        currentEnv: '',
        error: `YAML 파싱 실패: ${msg}`,
      };
    }

    const previousEnv = config.currentEnvironment;

    // 전환 검증
    const validation = validateEnvironmentSwitch(config, targetEnv);
    if (!validation.valid) {
      return {
        success: false,
        previousEnv,
        currentEnv: previousEnv,
        error: validation.message,
      };
    }

    // currentEnvironment 값 변경
    config.currentEnvironment = targetEnv;

    // YAML로 파일 다시 저장
    const updatedContent = stringify(config, {
      indent: 2,
      lineWidth: 0,
      minContentWidth: 0,
    });

    fs.writeFileSync(configPath, updatedContent, 'utf-8');

    return {
      success: true,
      previousEnv,
      currentEnv: targetEnv,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      previousEnv: '',
      currentEnv: '',
      error: `환경 전환 실패: ${msg}`,
    };
  }
}
