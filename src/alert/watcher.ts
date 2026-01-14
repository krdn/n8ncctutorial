/**
 * 알림 규칙 기반 Watcher 모듈
 * @description 규칙에 따라 자동으로 알림을 발생시키는 watcher
 */

import type { N8nApiClient } from '../api/index.js';
import type { AlertChannelConfig, AlertConfig, AlertResult, AlertRule } from './types.js';
import { detectErrors } from './detector.js';
import { triggerAlertForExecution } from './trigger.js';
import { evaluateRule, type RuleContext } from './rules.js';

/**
 * Watcher 상태
 */
export interface WatcherState {
  /** 마지막 체크 시점 */
  lastChecked: Date;
  /** 알림 이력 (규칙 ID -> 마지막 알림 시점) */
  alertHistory: Map<string, Date>;
}

/**
 * Watch 결과
 */
export interface WatchResult {
  /** 체크한 실행 수 */
  checked: number;
  /** 매칭된 규칙 수 */
  matched: number;
  /** 전송된 알림 수 */
  sent: number;
  /** 오류 목록 */
  errors: string[];
}

/**
 * Alert Watcher 인터페이스
 */
export interface AlertWatcher {
  /** 한 번 체크하고 규칙에 맞는 알림 전송 */
  checkOnce(): Promise<WatchResult>;
  /** 현재 상태 반환 */
  getState(): WatcherState;
}

/**
 * 채널 이름으로 채널 설정 찾기
 */
function findChannelsByNames(
  channelNames: string[],
  allChannels: AlertChannelConfig[]
): AlertChannelConfig[] {
  return allChannels.filter((ch) => {
    const name = ch.name ?? ch.type;
    return channelNames.includes(name);
  });
}

/**
 * 쿨다운 체크
 */
function isInCooldown(
  ruleId: string,
  cooldownSeconds: number | undefined,
  alertHistory: Map<string, Date>
): boolean {
  if (!cooldownSeconds || cooldownSeconds <= 0) {
    return false;
  }

  const lastAlert = alertHistory.get(ruleId);
  if (!lastAlert) {
    return false;
  }

  const cooldownMs = cooldownSeconds * 1000;
  const now = Date.now();
  return now - lastAlert.getTime() < cooldownMs;
}

/**
 * Alert Watcher 생성
 * @param client - n8n API 클라이언트
 * @param config - 알림 설정
 * @param rules - 알림 규칙 배열
 * @returns AlertWatcher 인스턴스
 */
export function createWatcher(
  client: N8nApiClient,
  config: AlertConfig,
  rules: AlertRule[]
): AlertWatcher {
  const state: WatcherState = {
    lastChecked: new Date(),
    alertHistory: new Map(),
  };

  return {
    async checkOnce(): Promise<WatchResult> {
      const result: WatchResult = {
        checked: 0,
        matched: 0,
        sent: 0,
        errors: [],
      };

      // 알림이 비활성화되어 있으면 종료
      if (!config.enabled) {
        return result;
      }

      // 에러 타입 규칙만 필터링
      const errorRules = rules.filter((r) => r.enabled && r.condition.type === 'error');

      if (errorRules.length === 0) {
        return result;
      }

      // 마지막 체크 이후 에러 감지
      const detection = await detectErrors(client, {
        since: state.lastChecked,
      });

      result.checked = detection.executions.length;
      state.lastChecked = new Date();

      if (!detection.hasErrors) {
        return result;
      }

      // 각 실행에 대해 규칙 평가
      for (const execution of detection.executions) {
        const context: RuleContext = { execution };

        for (const rule of errorRules) {
          // 쿨다운 체크
          if (isInCooldown(rule.id, rule.cooldown, state.alertHistory)) {
            continue;
          }

          // 규칙 평가
          if (!evaluateRule(rule, context)) {
            continue;
          }

          result.matched++;

          // 채널 찾기
          const channels = findChannelsByNames(rule.channels, config.channels);
          if (channels.length === 0) {
            result.errors.push(`규칙 "${rule.name}": 유효한 채널이 없습니다`);
            continue;
          }

          // 알림 전송
          try {
            const triggerResult = await triggerAlertForExecution(
              execution,
              channels,
              rule.severity
            );
            result.sent += triggerResult.alertsSent;

            // 실패한 알림 오류 수집
            for (const r of triggerResult.results) {
              if (!r.success && r.error) {
                result.errors.push(`[${r.channel}] ${r.error}`);
              }
            }

            // 알림 이력 업데이트
            state.alertHistory.set(rule.id, new Date());
          } catch (error) {
            result.errors.push(
              `규칙 "${rule.name}": ${error instanceof Error ? error.message : '알 수 없는 오류'}`
            );
          }
        }
      }

      return result;
    },

    getState(): WatcherState {
      return { ...state, alertHistory: new Map(state.alertHistory) };
    },
  };
}
