/**
 * 알림 규칙 관리 모듈
 * @description 알림 규칙의 로드, 저장, 평가 기능
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import * as yaml from 'yaml';
import type { N8nExecution } from '../types/n8n.js';
import type { WorkflowExecutionStats } from '../monitor/types.js';
import type { AlertRule, AlertRulesConfig } from './types.js';

/**
 * 규칙 평가 컨텍스트
 */
export interface RuleContext {
  /** 실행 정보 (error 조건용) */
  execution?: N8nExecution;
  /** 워크플로우 통계 (success_rate, duration 조건용) */
  stats?: WorkflowExecutionStats;
}

/**
 * 기본 규칙 파일 경로
 */
export const DEFAULT_RULES_PATH = '.n8n-wfm/alert-rules.yaml';

/**
 * 규칙 파일에서 규칙 로드
 * @param rulesPath - 규칙 파일 경로 (기본: .n8n-wfm/alert-rules.yaml)
 * @returns 알림 규칙 배열
 */
export async function loadRules(rulesPath: string = DEFAULT_RULES_PATH): Promise<AlertRule[]> {
  try {
    const content = await readFile(rulesPath, 'utf-8');
    const config = yaml.parse(content) as AlertRulesConfig;

    if (!config || !Array.isArray(config.rules)) {
      return [];
    }

    return config.rules;
  } catch (error) {
    // 파일이 없으면 빈 배열 반환
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

/**
 * 규칙을 파일로 저장
 * @param rulesPath - 규칙 파일 경로
 * @param rules - 저장할 규칙 배열
 */
export async function saveRules(rulesPath: string, rules: AlertRule[]): Promise<void> {
  const config: AlertRulesConfig = { rules };
  const content = yaml.stringify(config, {
    indent: 2,
    lineWidth: 0,
  });

  // 디렉토리 생성
  const dir = dirname(rulesPath);
  await mkdir(dir, { recursive: true });

  await writeFile(rulesPath, content, 'utf-8');
}

/**
 * 단일 규칙 평가
 * @param rule - 평가할 규칙
 * @param context - 평가 컨텍스트
 * @returns 규칙 조건 충족 여부
 */
export function evaluateRule(rule: AlertRule, context: RuleContext): boolean {
  // 비활성화된 규칙은 항상 false
  if (!rule.enabled) {
    return false;
  }

  const { condition } = rule;

  switch (condition.type) {
    case 'error': {
      // 실행이 에러 상태인지 확인
      if (!context.execution) {
        return false;
      }

      // 워크플로우 ID 필터링
      if (rule.workflowIds && rule.workflowIds.length > 0) {
        if (!rule.workflowIds.includes(context.execution.workflowId)) {
          return false;
        }
      }

      return context.execution.status === 'error';
    }

    case 'success_rate': {
      // 성공률 조건 평가
      if (!context.stats || condition.threshold === undefined) {
        return false;
      }

      // 워크플로우 ID 필터링
      if (rule.workflowIds && rule.workflowIds.length > 0) {
        if (!rule.workflowIds.includes(context.stats.workflowId)) {
          return false;
        }
      }

      const operator = condition.operator ?? 'lt';
      return compareValues(context.stats.successRate, condition.threshold, operator);
    }

    case 'duration': {
      // 실행 시간 조건 평가
      if (!context.stats?.avgDuration || condition.threshold === undefined) {
        return false;
      }

      // 워크플로우 ID 필터링
      if (rule.workflowIds && rule.workflowIds.length > 0) {
        if (!rule.workflowIds.includes(context.stats.workflowId)) {
          return false;
        }
      }

      const operator = condition.operator ?? 'gt';
      return compareValues(context.stats.avgDuration, condition.threshold, operator);
    }

    default:
      return false;
  }
}

/**
 * 값 비교
 * @param value - 비교할 값
 * @param threshold - 임계값
 * @param operator - 연산자
 * @returns 비교 결과
 */
function compareValues(value: number, threshold: number, operator: string): boolean {
  switch (operator) {
    case 'lt':
      return value < threshold;
    case 'gt':
      return value > threshold;
    case 'eq':
      return value === threshold;
    default:
      return false;
  }
}

/**
 * 컨텍스트에 매칭되는 활성 규칙 찾기
 * @param rules - 규칙 배열
 * @param context - 평가 컨텍스트
 * @returns 매칭되는 규칙 배열
 */
export function findMatchingRules(rules: AlertRule[], context: RuleContext): AlertRule[] {
  return rules.filter((rule) => evaluateRule(rule, context));
}

/**
 * 기본 규칙 생성
 * @returns 기본 알림 규칙 배열
 */
export function createDefaultRules(): AlertRule[] {
  return [
    {
      id: 'default-error',
      name: '기본 에러 알림',
      enabled: true,
      condition: {
        type: 'error',
      },
      channels: ['default'],
      severity: 'error',
      cooldown: 300, // 5분
    },
  ];
}
