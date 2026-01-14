/**
 * alert 명령어 모듈
 * @description 알림 테스트, 오류 체크, 상태 확인 명령어
 */

import type { Command } from 'commander';
import { createClient } from '../../api/index.js';
import { loadConfig } from '../../config/index.js';
import type { AlertConfig, AlertSeverity } from '../../alert/types.js';
import { sendAlerts, summarizeResults, createAlertMessage } from '../../alert/send.js';
import { detectErrors } from '../../alert/detector.js';
import { triggerAlertsForErrors } from '../../alert/trigger.js';
import type { EnvironmentConfig } from '../../types/config.js';

// ANSI 색상 코드
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

/**
 * 알림 설정 가져오기
 */
async function getAlertConfig(configPath?: string): Promise<AlertConfig | null> {
  try {
    const config = await loadConfig(configPath);
    return config.alerts ?? null;
  } catch (error) {
    console.error(`${colors.red}설정 파일 로드 실패:${colors.reset}`, error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * alert 명령어 등록
 */
export function registerAlertCommand(program: Command): void {
  const alertCmd = program
    .command('alert')
    .description('알림 관련 명령어 (테스트, 오류 체크, 상태 확인)');

  // alert test - 테스트 알림 전송
  alertCmd
    .command('test')
    .description('설정된 모든 채널로 테스트 알림 전송')
    .option('-c, --config <path>', '설정 파일 경로')
    .option('-m, --message <message>', '테스트 메시지', 'Test alert from n8n-wfm')
    .option('--severity <level>', '알림 심각도 (info, warning, error, critical)', 'info')
    .action(async (options) => {
      const alertConfig = await getAlertConfig(options.config);

      if (!alertConfig) {
        console.log(`${colors.yellow}알림 설정이 없습니다. 설정 파일에 alerts 섹션을 추가하세요.${colors.reset}`);
        return;
      }

      if (!alertConfig.enabled) {
        console.log(`${colors.yellow}알림이 비활성화되어 있습니다. (alerts.enabled: false)${colors.reset}`);
        return;
      }

      if (alertConfig.channels.length === 0) {
        console.log(`${colors.yellow}설정된 알림 채널이 없습니다.${colors.reset}`);
        return;
      }

      const message = createAlertMessage({
        title: 'n8n-wfm 테스트 알림',
        message: options.message,
        severity: options.severity as AlertSeverity,
      });

      console.log(`${colors.blue}테스트 알림 전송 중... (${alertConfig.channels.length}개 채널)${colors.reset}`);

      const results = await sendAlerts(message, alertConfig.channels);
      const summary = summarizeResults(results);

      console.log('');
      console.log(`${colors.bold}전송 결과:${colors.reset}`);
      console.log(`  총 채널: ${summary.total}`);
      console.log(`  성공: ${colors.green}${summary.success}${colors.reset}`);
      console.log(`  실패: ${colors.red}${summary.failed}${colors.reset}`);

      if (summary.errors.length > 0) {
        console.log('');
        console.log(`${colors.red}오류 목록:${colors.reset}`);
        for (const error of summary.errors) {
          console.log(`  - ${error}`);
        }
      }
    });

  // alert check - 현재 오류 상태 확인 및 알림
  alertCmd
    .command('check')
    .description('현재 오류 상태 확인 및 알림 전송')
    .option('-c, --config <path>', '설정 파일 경로')
    .option('-e, --env <name>', '환경 지정')
    .option('--since <time>', '확인 시작 시점 (예: 1h, 30m, 2h)', '1h')
    .option('--dry-run', '알림 전송 없이 감지된 오류만 출력')
    .action(async (options) => {
      const config = await loadConfig(options.config);
      const alertConfig = config.alerts;

      // 환경 결정
      const envName = options.env ?? config.currentEnvironment;
      const envConfig = config.environments.find((e: EnvironmentConfig) => e.name === envName);

      if (!envConfig) {
        console.error(`${colors.red}환경 "${envName}"을(를) 찾을 수 없습니다.${colors.reset}`);
        process.exit(1);
      }

      // since 파싱 (1h, 30m 등)
      const sinceMs = parseDuration(options.since);
      const since = new Date(Date.now() - sinceMs);

      console.log(`${colors.blue}오류 감지 중... (환경: ${envName}, 시작: ${since.toISOString()})${colors.reset}`);

      const client = createClient(envConfig);
      const detection = await detectErrors(client, { since });

      console.log('');
      console.log(`${colors.bold}감지 결과:${colors.reset}`);
      console.log(`  오류 발생: ${detection.hasErrors ? `${colors.red}예${colors.reset}` : `${colors.green}아니오${colors.reset}`}`);
      console.log(`  오류 실행 수: ${detection.executions.length}`);

      if (detection.hasErrors) {
        console.log('');
        console.log(`${colors.bold}오류 실행 목록:${colors.reset}`);
        for (const exec of detection.executions.slice(0, 10)) {
          console.log(`  - 실행 ID: ${exec.id}, 워크플로우: ${exec.workflowId}, 시작: ${exec.startedAt}`);
        }
        if (detection.executions.length > 10) {
          console.log(`  ... 외 ${detection.executions.length - 10}건`);
        }

        if (!options.dryRun && alertConfig?.enabled && alertConfig.channels.length > 0) {
          console.log('');
          console.log(`${colors.blue}알림 전송 중...${colors.reset}`);

          const result = await triggerAlertsForErrors(detection, alertConfig.channels);
          console.log(`  전송된 알림: ${result.alertsSent}`);
        } else if (options.dryRun) {
          console.log('');
          console.log(`${colors.yellow}(--dry-run 모드: 알림 전송 생략)${colors.reset}`);
        } else if (!alertConfig?.enabled) {
          console.log('');
          console.log(`${colors.yellow}알림이 비활성화되어 있어 전송하지 않습니다.${colors.reset}`);
        }
      }
    });

  // alert status - 알림 설정 상태 표시
  alertCmd
    .command('status')
    .description('알림 설정 상태 표시')
    .option('-c, --config <path>', '설정 파일 경로')
    .action(async (options) => {
      const alertConfig = await getAlertConfig(options.config);

      console.log(`${colors.bold}알림 설정 상태:${colors.reset}`);
      console.log('');

      if (!alertConfig) {
        console.log(`${colors.yellow}  알림 설정이 없습니다. 설정 파일에 alerts 섹션을 추가하세요.${colors.reset}`);
        return;
      }

      console.log(`  활성화: ${alertConfig.enabled ? `${colors.green}예${colors.reset}` : `${colors.red}아니오${colors.reset}`}`);
      console.log(`  채널 수: ${alertConfig.channels.length}`);

      if (alertConfig.channels.length > 0) {
        console.log('');
        console.log(`${colors.bold}  설정된 채널:${colors.reset}`);
        for (const channel of alertConfig.channels) {
          const name = channel.name ?? '(이름 없음)';
          const type = channel.type.toUpperCase();

          let detail = '';
          switch (channel.type) {
            case 'slack':
              detail = `Webhook: ${maskUrl(channel.webhookUrl)}`;
              break;
            case 'email':
              detail = `To: ${Array.isArray(channel.to) ? channel.to.join(', ') : channel.to}`;
              break;
            case 'webhook':
              detail = `URL: ${maskUrl(channel.url)}`;
              break;
          }

          console.log(`    - [${type}] ${name}: ${detail}`);
        }
      }
    });
}

/**
 * 시간 문자열 파싱 (1h, 30m, 2d 등)
 */
function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) {
    return 60 * 60 * 1000; // 기본 1시간
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 's':
      return value * 1000;
    case 'm':
      return value * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    case 'd':
      return value * 24 * 60 * 60 * 1000;
    default:
      return 60 * 60 * 1000;
  }
}

/**
 * URL 마스킹 (보안)
 */
function maskUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname;
    const maskedPath = path.length > 20 ? path.slice(0, 10) + '...' + path.slice(-5) : path;
    return `${parsed.protocol}//${parsed.host}${maskedPath}`;
  } catch {
    return url.slice(0, 30) + '...';
  }
}
