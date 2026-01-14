/**
 * monitor 명령어 모듈
 * @description 워크플로우 실행 상태를 모니터링하는 CLI 명령어
 */

import type { Command } from 'commander';
import { createClient } from '../../api/index.js';
import {
  loadConfig,
  getCurrentEnvironment,
  getEnvironment,
  configExists,
  findConfigPath,
} from '../../config/index.js';
import {
  fetchMonitoringData,
  getWorkflowStats,
  type ExecutionFilter,
  type ExecutionSummary,
  type WorkflowExecutionStats,
} from '../../monitor/index.js';
import type { N8nExecution, N8nExecutionStatus } from '../../types/n8n.js';

// ANSI 색상 코드 (터미널 호환)
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  white: '\x1b[37m',
};

/**
 * 색상 적용 헬퍼
 * @param text - 출력할 텍스트
 * @param color - 색상 키
 * @returns 색상이 적용된 문자열
 */
function colorize(text: string | number, color: keyof typeof colors): string {
  return `${colors[color]}${text}${colors.reset}`;
}

/**
 * 설정 파일 없음 안내 출력
 */
function printNoConfigMessage(): void {
  console.log(colorize('Error: Configuration not found', 'red'));
  console.log('');
  console.log('To get started:');
  console.log('  1. Copy config.example.yaml to n8n-wfm.config.yaml');
  console.log('  2. Edit the file with your n8n instance details');
  console.log('  3. Set environment variables for API keys');
  console.log('');
  console.log('Or use: n8n-wfm config init');
}

/**
 * 실행 시간 포맷팅
 * @param startedAt - 시작 시간
 * @param stoppedAt - 종료 시간 (없으면 실행 중)
 * @returns 사람이 읽기 쉬운 형식의 실행 시간
 */
function formatDuration(startedAt: string, stoppedAt?: string | null): string {
  if (!stoppedAt) {
    return colorize('running', 'yellow');
  }

  const start = new Date(startedAt).getTime();
  const stop = new Date(stoppedAt).getTime();
  const durationMs = stop - start;

  if (durationMs < 1000) {
    return `${durationMs}ms`;
  } else if (durationMs < 60000) {
    return `${(durationMs / 1000).toFixed(1)}s`;
  } else if (durationMs < 3600000) {
    const minutes = Math.floor(durationMs / 60000);
    const seconds = Math.floor((durationMs % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  } else {
    const hours = Math.floor(durationMs / 3600000);
    const minutes = Math.floor((durationMs % 3600000) / 60000);
    return `${hours}h ${minutes}m`;
  }
}

/**
 * 상태 포맷팅 (색상 적용)
 * @param status - 실행 상태
 * @returns 색상이 적용된 상태 문자열
 */
function formatStatus(status: N8nExecutionStatus): string {
  switch (status) {
    case 'success':
      return colorize('success', 'green');
    case 'error':
      return colorize('error', 'red');
    case 'running':
      return colorize('running', 'yellow');
    case 'waiting':
      return colorize('waiting', 'cyan');
    case 'canceled':
      return colorize('canceled', 'gray');
    default:
      return colorize(status, 'gray');
  }
}

/**
 * 날짜 포맷팅
 * @param dateStr - ISO 형식 날짜 문자열
 * @returns YYYY-MM-DD HH:mm 형식 문자열
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

/**
 * 문자열 고정 너비 출력
 * @param str - 출력할 문자열
 * @param width - 고정 너비
 * @returns 고정 너비로 조정된 문자열
 */
function padString(str: string, width: number): string {
  if (str.length > width) {
    return str.substring(0, width - 2) + '..';
  }
  return str.padEnd(width);
}

/**
 * 대시보드 헤더 출력
 * @param environment - 환경 이름
 */
function printDashboardHeader(environment: string): void {
  console.log('');
  console.log(`${colors.bold}${colors.blue}=== n8n Workflow Monitor ===${colors.reset}`);
  console.log(`Environment: ${colorize(environment, 'cyan')}`);
  console.log('');
}

/**
 * 요약 통계 출력
 * @param summary - 실행 요약
 */
function printSummary(summary: ExecutionSummary): void {
  const successRate =
    summary.total > 0 ? Math.round((summary.success / summary.total) * 100) : 0;

  console.log(`${colors.bold}Summary:${colors.reset}`);
  console.log(
    `  Total: ${colorize(summary.total, 'white')}   ` +
      `Success: ${colorize(summary.success, 'green')}   ` +
      `Error: ${colorize(summary.error, 'red')}   ` +
      `Running: ${colorize(summary.running, 'yellow')}`
  );

  const rateColor = successRate >= 80 ? 'green' : successRate >= 50 ? 'yellow' : 'red';
  console.log(`  Success Rate: ${colorize(successRate + '%', rateColor)}`);
  console.log('');
}

/**
 * 실행 목록 테이블 출력
 * @param executions - 실행 배열
 */
function printExecutionTable(executions: N8nExecution[]): void {
  if (executions.length === 0) {
    console.log(colorize('  No executions found.', 'gray'));
    return;
  }

  console.log(`${colors.bold}Recent Executions:${colors.reset}`);
  console.log(
    '  ' +
      colorize(
        padString('ID', 12) +
          padString('Workflow ID', 20) +
          padString('Status', 12) +
          padString('Started', 18) +
          'Duration',
        'gray'
      )
  );
  console.log(
    '  ' +
      colorize(
        '-'.repeat(12) +
          '-'.repeat(20) +
          '-'.repeat(12) +
          '-'.repeat(18) +
          '-'.repeat(10),
        'gray'
      )
  );

  for (const exec of executions) {
    const id = padString(String(exec.id), 12);
    const workflow = padString(exec.workflowId, 20);
    const started = padString(formatDate(exec.startedAt), 18);
    const duration = formatDuration(exec.startedAt, exec.stoppedAt);

    // 상태는 ANSI 코드가 포함되어 표시 너비가 달라지므로 별도로 패딩
    const statusText = formatStatus(exec.status);
    const statusPadding = ' '.repeat(Math.max(0, 12 - exec.status.length));

    console.log(`  ${id}${workflow}${statusText}${statusPadding}${started}${duration}`);
  }
}

/**
 * ASCII 프로그레스 바 생성
 * @param value - 현재 값
 * @param max - 최대 값
 * @param width - 바 너비 (기본 20)
 * @returns 프로그레스 바 문자열
 */
function printProgressBar(value: number, max: number, width = 20): string {
  if (max === 0) return '░'.repeat(width);

  const ratio = Math.min(value / max, 1);
  const filled = Math.round(ratio * width);
  const empty = width - filled;

  return '█'.repeat(filled) + '░'.repeat(empty);
}

/**
 * 워크플로우 통계 출력
 * @param stats - 워크플로우 실행 통계
 * @param limit - 분석 개수
 */
function printWorkflowStats(stats: WorkflowExecutionStats, limit: number): void {
  console.log('');
  console.log(`${colors.bold}${colors.blue}=== Workflow Stats ===${colors.reset}`);
  console.log(`Workflow: ${colorize(stats.workflowName, 'cyan')} (id: ${stats.workflowId})`);
  console.log('');

  console.log(`${colors.bold}Statistics (last ${limit} executions):${colors.reset}`);
  console.log(`  Total Executions: ${stats.totalExecutions}`);

  const rateColor =
    stats.successRate >= 80 ? 'green' : stats.successRate >= 50 ? 'yellow' : 'red';
  console.log(`  Success Rate: ${colorize(stats.successRate + '%', rateColor)}`);

  if (stats.avgDuration !== undefined) {
    const avgDurationStr = formatDurationMs(stats.avgDuration);
    console.log(`  Average Duration: ${avgDurationStr}`);
  }

  if (stats.lastExecution) {
    console.log(`  Last Execution: ${formatDate(stats.lastExecution.toISOString())}`);
  }

  if (stats.lastStatus) {
    console.log(`  Last Status: ${formatStatus(stats.lastStatus)}`);
  }

  console.log('');

  // 상태 분포 바
  if (stats.totalExecutions > 0) {
    const successCount = Math.round(
      (stats.successRate / 100) * stats.totalExecutions
    );
    const errorCount = stats.totalExecutions - successCount;

    console.log(`${colors.bold}Status Distribution:${colors.reset}`);
    console.log(
      `  Success: ${printProgressBar(successCount, stats.totalExecutions)} ${successCount}`
    );
    console.log(
      `  Error:   ${printProgressBar(errorCount, stats.totalExecutions)} ${errorCount}`
    );
  }
}

/**
 * 밀리초 단위 시간 포맷팅
 * @param ms - 밀리초
 * @returns 사람이 읽기 쉬운 형식
 */
function formatDurationMs(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  } else if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  } else {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }
}

/**
 * 상태 문자열을 ExecutionStatus로 변환
 * @param status - 상태 문자열
 * @returns N8nExecutionStatus 또는 undefined
 */
function parseStatusFilter(
  status?: string
): N8nExecutionStatus | N8nExecutionStatus[] | undefined {
  if (!status) return undefined;

  const validStatuses: N8nExecutionStatus[] = [
    'success',
    'error',
    'running',
    'waiting',
    'canceled',
    'unknown',
  ];

  const lower = status.toLowerCase() as N8nExecutionStatus;
  if (validStatuses.includes(lower)) {
    return lower;
  }

  console.log(colorize(`Warning: Unknown status '${status}', ignoring filter.`, 'yellow'));
  return undefined;
}

/**
 * monitor 명령어 등록
 * @param program - Commander 프로그램 인스턴스
 */
export function registerMonitorCommand(program: Command): void {
  const monitorCmd = program
    .command('monitor')
    .description('워크플로우 실행 상태 모니터링')
    .option('-c, --config <path>', '설정 파일 경로')
    .option('-e, --env <name>', '환경 지정')
    .option('-l, --limit <n>', '표시할 최근 실행 개수', '20')
    .option('-s, --status <status>', '상태 필터 (success, error, running)')
    .action(
      async (options: {
        config?: string;
        env?: string;
        limit: string;
        status?: string;
      }) => {
        // 설정 파일 존재 확인
        if (!configExists(options.config)) {
          printNoConfigMessage();
          process.exitCode = 1;
          return;
        }

        const configPath = findConfigPath(options.config);
        if (configPath) {
          console.log(`Using config: ${configPath}`);
        }

        try {
          // 설정 로드
          const config = loadConfig(options.config);

          // 환경 선택
          const envConfig = options.env
            ? getEnvironment(config, options.env)
            : getCurrentEnvironment(config);

          // 대시보드 헤더 출력
          printDashboardHeader(envConfig.name);

          // API 클라이언트 생성
          const client = createClient(envConfig);

          // 필터 구성
          const limit = parseInt(options.limit, 10) || 20;
          const filter: ExecutionFilter = {
            limit,
            status: parseStatusFilter(options.status),
          };

          // 모니터링 데이터 조회
          const result = await fetchMonitoringData(client, filter);

          // 요약 출력
          printSummary(result.summary);

          // 실행 목록 출력
          printExecutionTable(result.executions);

          console.log('');
          console.log(
            colorize(`Fetched at: ${formatDate(result.fetchedAt.toISOString())}`, 'gray')
          );
        } catch (error) {
          console.log(colorize('Error', 'red'));
          console.log('');
          const message = error instanceof Error ? error.message : String(error);
          console.log(`  ${message}`);
          process.exitCode = 1;
        }
      }
    );

  // workflow 서브커맨드
  monitorCmd
    .command('workflow <workflow-id>')
    .description('특정 워크플로우의 실행 통계')
    .option('-c, --config <path>', '설정 파일 경로')
    .option('-e, --env <name>', '환경 지정')
    .option('-l, --limit <n>', '분석할 실행 개수', '100')
    .action(
      async (
        workflowId: string,
        options: {
          config?: string;
          env?: string;
          limit: string;
        }
      ) => {
        // 설정 파일 존재 확인
        if (!configExists(options.config)) {
          printNoConfigMessage();
          process.exitCode = 1;
          return;
        }

        const configPath = findConfigPath(options.config);
        if (configPath) {
          console.log(`Using config: ${configPath}`);
        }

        try {
          // 설정 로드
          const config = loadConfig(options.config);

          // 환경 선택
          const envConfig = options.env
            ? getEnvironment(config, options.env)
            : getCurrentEnvironment(config);

          // API 클라이언트 생성
          const client = createClient(envConfig);

          // 분석 개수
          const limit = parseInt(options.limit, 10) || 100;

          // 워크플로우 통계 조회
          const stats = await getWorkflowStats(client, workflowId, limit);

          // 통계 출력
          printWorkflowStats(stats, limit);
        } catch (error) {
          console.log(colorize('Error', 'red'));
          console.log('');
          const message = error instanceof Error ? error.message : String(error);
          console.log(`  ${message}`);
          process.exitCode = 1;
        }
      }
    );
}
