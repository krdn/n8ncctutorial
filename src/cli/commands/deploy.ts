/**
 * deploy 명령어 모듈
 * @description 워크플로우 배포 CLI 명령어 (deploy, deploy status, deploy rollback)
 */

import type { Command } from 'commander';
import {
  loadConfig,
  configExists,
  findConfigPath,
  getEnvironment,
} from '../../config/index.js';
import { createClient } from '../../api/index.js';
import {
  DeploymentPipeline,
  DEFAULT_DEPLOYMENT_OPTIONS,
  listDeploymentRecords,
  loadDeploymentRecord,
  getLatestDeploymentRecord,
  rollbackDeployment,
} from '../../deploy/index.js';
import type { DeploymentResult } from '../../deploy/index.js';

/**
 * 설정 파일 없음 안내 출력
 */
function printNoConfigMessage(): void {
  console.log('Error: Configuration not found');
  console.log('');
  console.log('To get started:');
  console.log('  1. Copy config.example.yaml to n8n-wfm.config.yaml');
  console.log('  2. Edit the file with your n8n instance details');
  console.log('  3. Set environment variables for API keys');
  console.log('');
  console.log('Or use: n8n-wfm config init');
}

/**
 * 배포 결과 출력
 * @param result - 배포 결과
 * @param isDryRun - dry-run 모드 여부
 */
function printDeploymentResult(result: DeploymentResult, isDryRun: boolean): void {
  console.log('');

  if (isDryRun) {
    console.log('[DRY-RUN] 시뮬레이션 모드 - 실제 배포 없음');
    console.log('');
  }

  console.log('배포 결과');
  console.log('─'.repeat(60));
  console.log('');

  // 환경 정보
  console.log(`  소스 환경: ${result.sourceEnv}`);
  console.log(`  대상 환경: ${result.targetEnv}`);
  console.log(`  시간: ${result.timestamp}`);
  console.log('');

  // 워크플로우 테이블
  if (result.workflows.length > 0) {
    console.log('  워크플로우:');
    console.log('  ' + '─'.repeat(56));
    console.log(
      '  ' +
        'ID'.padEnd(12) +
        '이름'.padEnd(30) +
        '작업'.padEnd(10) +
        '상태'
    );
    console.log('  ' + '─'.repeat(56));

    for (const wf of result.workflows) {
      // 이름이 길면 자르기
      const displayName = wf.workflowName.length > 28
        ? wf.workflowName.slice(0, 25) + '...'
        : wf.workflowName;

      const actionSymbol =
        wf.action === 'created' ? '+' :
        wf.action === 'updated' ? '~' :
        wf.action === 'skipped' ? '-' : ' ';

      console.log(
        '  ' +
          wf.workflowId.padEnd(12) +
          displayName.padEnd(30) +
          `[${actionSymbol}] ${wf.action}`.padEnd(10) +
          (wf.credentialsTransformed > 0 ? `+${wf.credentialsTransformed} cred` : '')
      );
    }
    console.log('  ' + '─'.repeat(56));
    console.log('');
  }

  // 요약
  console.log('  요약:');
  console.log(`    전체: ${result.summary.total}개`);
  console.log(`    생성: ${result.summary.created}개`);
  console.log(`    업데이트: ${result.summary.updated}개`);
  console.log(`    건너뜀: ${result.summary.skipped}개`);
  console.log(`    실패: ${result.summary.failed}개`);
  console.log('');

  // 에러 출력
  if (result.errors.length > 0) {
    console.log('  에러:');
    for (const err of result.errors) {
      console.log(`    - [${err.phase}] ${err.workflowName || err.workflowId}: ${err.message}`);
    }
    console.log('');
  }

  // 최종 상태
  if (result.success) {
    console.log('\u2713 배포 완료!');
  } else {
    console.log('\u2717 배포 실패');
  }
}

/**
 * deploy 명령어 등록
 * @param program - Commander 프로그램 인스턴스
 */
export function registerDeployCommand(program: Command): void {
  const deployCmd = program
    .command('deploy')
    .description('워크플로우 배포 관리');

  // deploy <source> <target> - 메인 배포 명령어
  deployCmd
    .command('run <source> <target>')
    .description('소스 환경에서 대상 환경으로 워크플로우 배포')
    .option('-c, --config <path>', '설정 파일 경로')
    .option('-w, --workflows <ids>', '특정 워크플로우 ID (쉼표 구분)')
    .option('--dry-run', '시뮬레이션 모드 (실제 배포 없음)')
    .option('--no-backup', '배포 전 백업 생략')
    .option('--activate', '배포 후 워크플로우 활성화')
    .option('--force', '기존 워크플로우 강제 덮어쓰기')
    .action(
      async (
        source: string,
        target: string,
        options: {
          config?: string;
          workflows?: string;
          dryRun?: boolean;
          backup: boolean;
          activate?: boolean;
          force?: boolean;
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

          // 소스/대상 환경 가져오기
          const sourceEnv = getEnvironment(config, source);
          const targetEnv = getEnvironment(config, target);

          console.log('');
          console.log('배포 시작');
          console.log(`  ${source} -> ${target}`);
          console.log('');

          if (options.dryRun) {
            console.log('[DRY-RUN] 시뮬레이션 모드');
          }

          if (options.workflows) {
            console.log(`  워크플로우: ${options.workflows}`);
          } else {
            console.log('  워크플로우: 전체');
          }

          console.log('');
          console.log('워크플로우 배포 중...');

          // API 클라이언트 생성
          const sourceClient = createClient(sourceEnv);
          const targetClient = createClient(targetEnv);

          // 배포 파이프라인 생성
          const pipeline = new DeploymentPipeline(
            sourceClient,
            targetClient,
            config
          );

          // 배포 옵션 구성
          const deploymentOptions = {
            ...DEFAULT_DEPLOYMENT_OPTIONS,
            dryRun: options.dryRun ?? false,
            createBackup: options.backup,
            activateAfterDeploy: options.activate ?? false,
            overwrite: options.force ?? DEFAULT_DEPLOYMENT_OPTIONS.overwrite,
          };

          // 워크플로우 ID 파싱
          const workflowIds = options.workflows
            ? options.workflows.split(',').map((id) => id.trim())
            : undefined;

          // 배포 실행
          const result = await pipeline.runPipeline(
            {
              sourceEnv: source,
              targetEnv: target,
              workflowIds,
            },
            deploymentOptions
          );

          // 결과 출력
          printDeploymentResult(result, options.dryRun ?? false);

          if (!result.success) {
            process.exitCode = 1;
          }
        } catch (error) {
          console.log('Error');
          console.log('');
          const message = error instanceof Error ? error.message : String(error);
          console.log(`  ${message}`);
          process.exitCode = 1;
        }
      }
    );

  // deploy status - 배포 이력 조회
  deployCmd
    .command('status')
    .description('배포 이력 조회')
    .option('-l, --limit <n>', '표시할 최대 개수', '10')
    .option('-e, --env <name>', '특정 환경 필터')
    .action(
      async (options: { limit: string; env?: string }) => {
        try {
          const limit = parseInt(options.limit, 10) || 10;
          const baseDir = process.cwd();

          // 배포 기록 조회
          let records = await listDeploymentRecords(baseDir);

          // 환경 필터 적용
          if (options.env) {
            records = records.filter(
              (r) => r.sourceEnv === options.env || r.targetEnv === options.env
            );
          }

          // 개수 제한
          records = records.slice(0, limit);

          if (records.length === 0) {
            console.log('');
            console.log('배포 기록이 없습니다.');
            console.log('');
            console.log('워크플로우를 배포하려면:');
            console.log('  n8n-wfm deploy run <source> <target>');
            return;
          }

          console.log('');
          console.log('배포 이력');
          console.log('─'.repeat(80));
          console.log(
            '  ' +
              'ID'.padEnd(24) +
              '시간'.padEnd(22) +
              '경로'.padEnd(20) +
              '워크플로우'
          );
          console.log('─'.repeat(80));

          for (const record of records) {
            const date = new Date(record.timestamp);
            const timeStr = date.toLocaleString('ko-KR', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
            });

            const pathStr = `${record.sourceEnv} -> ${record.targetEnv}`;
            const wfCount = record.workflows.length;

            console.log(
              '  ' +
                record.id.slice(0, 22).padEnd(24) +
                timeStr.padEnd(22) +
                pathStr.padEnd(20) +
                `${wfCount}개`
            );
          }

          console.log('─'.repeat(80));
          console.log('');
          console.log(`총 ${records.length}개의 배포 기록`);
        } catch (error) {
          console.log('Error');
          console.log('');
          const message = error instanceof Error ? error.message : String(error);
          console.log(`  ${message}`);
          process.exitCode = 1;
        }
      }
    );

  // deploy rollback - 롤백 실행
  deployCmd
    .command('rollback [deployment-id]')
    .description('이전 배포 상태로 롤백')
    .option('-c, --config <path>', '설정 파일 경로')
    .option('-w, --workflows <ids>', '특정 워크플로우만 롤백 (쉼표 구분)')
    .option('-y, --yes', '확인 없이 롤백 실행')
    .action(
      async (
        deploymentId: string | undefined,
        options: {
          config?: string;
          workflows?: string;
          yes?: boolean;
        }
      ) => {
        // 설정 파일 존재 확인
        if (!configExists(options.config)) {
          printNoConfigMessage();
          process.exitCode = 1;
          return;
        }

        try {
          const baseDir = process.cwd();

          // 배포 기록 조회
          let record;
          if (deploymentId) {
            record = await loadDeploymentRecord(deploymentId, baseDir);
            if (!record) {
              console.log(`\u2717 배포 기록을 찾을 수 없습니다: ${deploymentId}`);
              console.log('');
              console.log('배포 이력을 확인하려면: n8n-wfm deploy status');
              process.exitCode = 1;
              return;
            }
          } else {
            record = await getLatestDeploymentRecord(baseDir);
            if (!record) {
              console.log('롤백할 배포 기록이 없습니다.');
              process.exitCode = 1;
              return;
            }
          }

          // 배포 정보 출력
          console.log('');
          console.log('롤백 대상');
          console.log('─'.repeat(40));
          console.log(`  배포 ID: ${record.id}`);
          console.log(`  시간: ${record.timestamp}`);
          console.log(`  경로: ${record.sourceEnv} -> ${record.targetEnv}`);
          console.log(`  워크플로우: ${record.workflows.length}개`);
          if (record.backupPath) {
            console.log(`  백업: ${record.backupPath}`);
          } else {
            console.log('  백업: 없음 (롤백 불가)');
            process.exitCode = 1;
            return;
          }
          console.log('');

          // 확인 프롬프트 (--yes가 없을 때)
          if (!options.yes) {
            console.log('롤백을 실행하면 대상 환경의 워크플로우가 백업 시점으로 복원됩니다.');
            console.log('');
            console.log('--yes 옵션을 추가하여 롤백을 실행하세요:');
            console.log(`  n8n-wfm deploy rollback ${record.id} --yes`);
            return;
          }

          // 설정 로드 및 API 클라이언트 생성
          const config = loadConfig(options.config);
          const targetEnvConfig = getEnvironment(config, record.targetEnv);
          const targetClient = createClient(targetEnvConfig);

          // 롤백 옵션 구성
          const rollbackOptions = {
            workflowIds: options.workflows
              ? options.workflows.split(',').map((id) => id.trim())
              : undefined,
          };

          console.log('롤백 실행 중...');
          console.log('');

          // 롤백 실행
          const result = await rollbackDeployment(targetClient, record, rollbackOptions);

          // 결과 출력
          if (result.success) {
            console.log('\u2713 롤백 완료!');
            console.log(`  복원된 워크플로우: ${result.restoredCount}개`);
          } else {
            console.log('\u2717 롤백 실패');
            console.log(`  복원된 워크플로우: ${result.restoredCount}개`);
            for (const err of result.errors) {
              console.log(`  - ${err}`);
            }
            process.exitCode = 1;
          }
        } catch (error) {
          console.log('Error');
          console.log('');
          const message = error instanceof Error ? error.message : String(error);
          console.log(`  ${message}`);
          process.exitCode = 1;
        }
      }
    );

  // deploy diff - 환경 간 차이 비교 (선택적 기능)
  deployCmd
    .command('diff <source> <target>')
    .description('소스와 대상 환경 간 워크플로우 차이 비교')
    .option('-c, --config <path>', '설정 파일 경로')
    .action(
      async (
        source: string,
        target: string,
        options: { config?: string }
      ) => {
        // 설정 파일 존재 확인
        if (!configExists(options.config)) {
          printNoConfigMessage();
          process.exitCode = 1;
          return;
        }

        try {
          // 설정 로드
          const config = loadConfig(options.config);

          // 소스/대상 환경 가져오기
          const sourceEnv = getEnvironment(config, source);
          const targetEnv = getEnvironment(config, target);

          // API 클라이언트 생성
          const sourceClient = createClient(sourceEnv);
          const targetClient = createClient(targetEnv);

          console.log('');
          console.log('환경 비교');
          console.log(`  ${source} vs ${target}`);
          console.log('');
          console.log('워크플로우 조회 중...');

          // 워크플로우 목록 조회
          const [sourceWorkflows, targetWorkflows] = await Promise.all([
            sourceClient.getAllWorkflows(),
            targetClient.getAllWorkflows(),
          ]);

          // 이름 기준 비교
          const sourceNames = new Set(sourceWorkflows.map((w) => w.name));
          const targetNames = new Set(targetWorkflows.map((w) => w.name));

          const onlyInSource = sourceWorkflows.filter((w) => !targetNames.has(w.name));
          const onlyInTarget = targetWorkflows.filter((w) => !sourceNames.has(w.name));
          const inBoth = sourceWorkflows.filter((w) => targetNames.has(w.name));

          console.log('');
          console.log('비교 결과');
          console.log('─'.repeat(60));
          console.log('');

          // 소스에만 있는 워크플로우
          if (onlyInSource.length > 0) {
            console.log(`  ${source}에만 있음 (${onlyInSource.length}개):`);
            for (const wf of onlyInSource) {
              console.log(`    + ${wf.name}`);
            }
            console.log('');
          }

          // 대상에만 있는 워크플로우
          if (onlyInTarget.length > 0) {
            console.log(`  ${target}에만 있음 (${onlyInTarget.length}개):`);
            for (const wf of onlyInTarget) {
              console.log(`    - ${wf.name}`);
            }
            console.log('');
          }

          // 양쪽에 있는 워크플로우
          if (inBoth.length > 0) {
            console.log(`  양쪽에 있음 (${inBoth.length}개):`);
            for (const wf of inBoth) {
              console.log(`    = ${wf.name}`);
            }
            console.log('');
          }

          // 요약
          console.log('─'.repeat(60));
          console.log('');
          console.log('  요약:');
          console.log(`    ${source}: ${sourceWorkflows.length}개`);
          console.log(`    ${target}: ${targetWorkflows.length}개`);
          console.log(`    ${source}에만: ${onlyInSource.length}개`);
          console.log(`    ${target}에만: ${onlyInTarget.length}개`);
          console.log(`    공통: ${inBoth.length}개`);
        } catch (error) {
          console.log('Error');
          console.log('');
          const message = error instanceof Error ? error.message : String(error);
          console.log(`  ${message}`);
          process.exitCode = 1;
        }
      }
    );
}
