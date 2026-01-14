/**
 * 배포 파이프라인 모듈
 * @description 워크플로우 배포를 위한 파이프라인 패턴 구현
 */

import type { N8nApiClient } from '../api/client.js';
import type { Config, CredentialTransform } from '../types/config.js';
import type { N8nWorkflowDetail, N8nNode } from '../types/n8n.js';
import { buildCredentialTransform } from '../config/credentials.js';
import type {
  DeploymentTarget,
  DeploymentOptions,
  DeploymentResult,
  DeployedWorkflow,
  DeploymentError,
  DeploymentSummary,
} from './types.js';
import { DEFAULT_DEPLOYMENT_OPTIONS } from './types.js';

/**
 * 검증 결과
 * @description validate 단계의 결과
 */
export interface ValidationResult {
  /** 검증 성공 여부 */
  valid: boolean;
  /** 에러 목록 */
  errors: string[];
}

/**
 * 준비 결과
 * @description prepare 단계의 결과
 */
export interface PrepareResult {
  /** 배포할 워크플로우 목록 */
  workflows: N8nWorkflowDetail[];
  /** credential 변환 맵 */
  credentialTransform: CredentialTransform;
}

/**
 * 배포 파이프라인 클래스
 * @description 소스 환경에서 대상 환경으로 워크플로우를 배포하는 파이프라인
 *
 * 파이프라인 단계:
 * 1. validate - 소스/대상 환경 및 워크플로우 유효성 검증
 * 2. prepare - 배포 대상 워크플로우 조회 및 credential 변환 맵 생성
 * 3. transformCredentials - 워크플로우 내 credential ID 변환
 * 4. deploy - 단일 워크플로우 배포 실행
 * 5. verify - 배포된 워크플로우 존재 확인
 */
export class DeploymentPipeline {
  private readonly sourceClient: N8nApiClient;
  private readonly targetClient: N8nApiClient;
  private readonly config: Config;

  /**
   * DeploymentPipeline 생성
   * @param sourceClient - 소스 환경 API 클라이언트
   * @param targetClient - 대상 환경 API 클라이언트
   * @param config - 전체 설정 객체
   */
  constructor(
    sourceClient: N8nApiClient,
    targetClient: N8nApiClient,
    config: Config
  ) {
    this.sourceClient = sourceClient;
    this.targetClient = targetClient;
    this.config = config;
  }

  /**
   * 배포 대상 검증
   * @description 소스/대상 환경 존재 확인, 워크플로우 ID 유효성 확인, credential 매핑 검증
   * @param target - 배포 대상 설정
   * @returns 검증 결과
   */
  async validate(target: DeploymentTarget): Promise<ValidationResult> {
    const errors: string[] = [];

    // 소스 환경 존재 확인
    const sourceEnv = this.config.environments.find(
      (env) => env.name === target.sourceEnv
    );
    if (!sourceEnv) {
      errors.push(`소스 환경 "${target.sourceEnv}"을(를) 찾을 수 없습니다`);
    }

    // 대상 환경 존재 확인
    const targetEnv = this.config.environments.find(
      (env) => env.name === target.targetEnv
    );
    if (!targetEnv) {
      errors.push(`대상 환경 "${target.targetEnv}"을(를) 찾을 수 없습니다`);
    }

    // 소스/대상 환경이 같은지 확인
    if (target.sourceEnv === target.targetEnv) {
      errors.push('소스 환경과 대상 환경이 동일합니다');
    }

    // 환경 연결 확인
    if (errors.length === 0) {
      try {
        const sourceHealthy = await this.sourceClient.healthCheck();
        if (!sourceHealthy) {
          errors.push(`소스 환경 "${target.sourceEnv}"에 연결할 수 없습니다`);
        }
      } catch {
        errors.push(`소스 환경 "${target.sourceEnv}" 연결 확인 실패`);
      }

      try {
        const targetHealthy = await this.targetClient.healthCheck();
        if (!targetHealthy) {
          errors.push(`대상 환경 "${target.targetEnv}"에 연결할 수 없습니다`);
        }
      } catch {
        errors.push(`대상 환경 "${target.targetEnv}" 연결 확인 실패`);
      }
    }

    // 특정 워크플로우 ID가 지정된 경우 유효성 확인
    if (target.workflowIds && target.workflowIds.length > 0 && errors.length === 0) {
      try {
        const workflows = await this.sourceClient.getAllWorkflows();
        const workflowIds = new Set(workflows.map((w) => w.id));

        for (const id of target.workflowIds) {
          if (!workflowIds.has(id)) {
            errors.push(`워크플로우 ID "${id}"을(를) 소스 환경에서 찾을 수 없습니다`);
          }
        }
      } catch {
        errors.push('소스 환경에서 워크플로우 목록을 조회할 수 없습니다');
      }
    }

    // credential 매핑 검증
    const credentialTransform = buildCredentialTransform(
      this.config,
      target.sourceEnv,
      target.targetEnv
    );

    if (credentialTransform.mappings.length === 0 && this.config.credentialMappings?.length) {
      // 매핑이 있는데 변환 가능한 것이 없으면 경고
      errors.push(
        `"${target.sourceEnv}"와 "${target.targetEnv}" 간 변환 가능한 credential 매핑이 없습니다`
      );
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * 배포 준비
   * @description 배포 대상 워크플로우 목록 조회 및 credential 변환 맵 생성
   * @param target - 배포 대상 설정
   * @returns 준비 결과
   */
  async prepare(target: DeploymentTarget): Promise<PrepareResult> {
    // 워크플로우 목록 조회
    let workflows: N8nWorkflowDetail[];

    if (target.workflowIds && target.workflowIds.length > 0) {
      // 특정 워크플로우만 조회
      workflows = await Promise.all(
        target.workflowIds.map((id) => this.sourceClient.getWorkflow(id))
      );
    } else {
      // 전체 워크플로우 조회
      const workflowList = await this.sourceClient.getAllWorkflows();
      workflows = await Promise.all(
        workflowList.map((w) => this.sourceClient.getWorkflow(w.id))
      );
    }

    // credential 변환 맵 생성
    const credentialTransform = buildCredentialTransform(
      this.config,
      target.sourceEnv,
      target.targetEnv
    );

    return {
      workflows,
      credentialTransform,
    };
  }

  /**
   * 워크플로우 credential 변환
   * @description 워크플로우 내 credential ID를 대상 환경 ID로 변환
   * @param workflow - 원본 워크플로우
   * @param transform - credential 변환 맵
   * @returns 변환된 워크플로우와 변환 개수
   */
  transformCredentials(
    workflow: N8nWorkflowDetail,
    transform: CredentialTransform
  ): { workflow: N8nWorkflowDetail; transformedCount: number } {
    let transformedCount = 0;

    // credential ID 매핑 맵 생성 (빠른 조회용)
    const idMap = new Map<string, string>();
    for (const mapping of transform.mappings) {
      idMap.set(mapping.originalId, mapping.newId);
    }

    // 노드의 credential 변환
    const transformedNodes: N8nNode[] = workflow.nodes.map((node) => {
      if (!node.credentials) {
        return node;
      }

      const transformedCredentials: Record<string, unknown> = {};
      let nodeTransformed = false;

      for (const [key, value] of Object.entries(node.credentials)) {
        if (typeof value === 'object' && value !== null) {
          const credObj = value as Record<string, unknown>;
          const originalId = String(credObj.id);

          if (idMap.has(originalId)) {
            transformedCredentials[key] = {
              ...credObj,
              id: idMap.get(originalId),
            };
            nodeTransformed = true;
          } else {
            transformedCredentials[key] = value;
          }
        } else {
          transformedCredentials[key] = value;
        }
      }

      if (nodeTransformed) {
        transformedCount++;
      }

      return {
        ...node,
        credentials: transformedCredentials,
      };
    });

    return {
      workflow: {
        ...workflow,
        nodes: transformedNodes,
      },
      transformedCount,
    };
  }

  /**
   * 단일 워크플로우 배포
   * @description 대상 환경에 워크플로우 생성 또는 업데이트
   * @param workflow - 배포할 워크플로우
   * @param credentialsTransformed - 변환된 credential 개수
   * @param options - 배포 옵션
   * @returns 배포된 워크플로우 정보
   */
  async deploy(
    workflow: N8nWorkflowDetail,
    credentialsTransformed: number,
    options: DeploymentOptions
  ): Promise<DeployedWorkflow> {
    // 대상 환경에서 동일 이름 워크플로우 검색
    const targetWorkflows = await this.targetClient.getAllWorkflows();
    const existing = targetWorkflows.find((w) => w.name === workflow.name);

    let action: 'created' | 'updated' | 'skipped';
    let targetId: string;

    // 배포 데이터 준비 (ID, 날짜 필드 제거)
    const { id, createdAt, updatedAt, ...workflowData } = workflow;

    if (existing) {
      if (!options.overwrite) {
        // 덮어쓰기 비활성화 - 건너뛰기
        return {
          workflowId: workflow.id,
          workflowName: workflow.name,
          targetId: existing.id,
          action: 'skipped',
          credentialsTransformed: 0,
        };
      }

      // 기존 워크플로우 업데이트
      const result = await this.targetClient.updateWorkflow(existing.id, workflowData);
      targetId = result.id;
      action = 'updated';
    } else {
      // 신규 워크플로우 생성
      const result = await this.targetClient.createWorkflow(workflowData);
      targetId = result.id;
      action = 'created';
    }

    // 활성화 옵션 처리
    if (options.activateAfterDeploy) {
      await this.targetClient.activateWorkflow(targetId);
    }

    return {
      workflowId: workflow.id,
      workflowName: workflow.name,
      targetId,
      action,
      credentialsTransformed,
    };
  }

  /**
   * 배포 확인
   * @description 대상 환경에 워크플로우가 존재하는지 확인
   * @param workflowId - 대상 환경의 워크플로우 ID
   * @returns 존재 여부
   */
  async verify(workflowId: string): Promise<boolean> {
    try {
      await this.targetClient.getWorkflow(workflowId);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 전체 파이프라인 실행
   * @description validate → prepare → transform → deploy → verify 순서로 실행
   * @param target - 배포 대상 설정
   * @param options - 배포 옵션 (기본값 적용)
   * @returns 배포 결과
   */
  async runPipeline(
    target: DeploymentTarget,
    options: Partial<DeploymentOptions> = {}
  ): Promise<DeploymentResult> {
    const opts: DeploymentOptions = { ...DEFAULT_DEPLOYMENT_OPTIONS, ...options };
    const errors: DeploymentError[] = [];
    const deployedWorkflows: DeployedWorkflow[] = [];
    const timestamp = new Date().toISOString();

    // 1. 검증 단계
    if (!opts.skipValidation) {
      const validation = await this.validate(target);
      if (!validation.valid) {
        return {
          success: false,
          timestamp,
          sourceEnv: target.sourceEnv,
          targetEnv: target.targetEnv,
          workflows: [],
          summary: { total: 0, created: 0, updated: 0, skipped: 0, failed: 0 },
          errors: validation.errors.map((msg) => ({
            workflowId: '',
            workflowName: '',
            phase: 'validation' as const,
            message: msg,
          })),
        };
      }
    }

    // 2. 준비 단계
    let prepareResult: PrepareResult;
    try {
      prepareResult = await this.prepare(target);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        timestamp,
        sourceEnv: target.sourceEnv,
        targetEnv: target.targetEnv,
        workflows: [],
        summary: { total: 0, created: 0, updated: 0, skipped: 0, failed: 0 },
        errors: [{
          workflowId: '',
          workflowName: '',
          phase: 'validation',
          message: `준비 단계 실패: ${msg}`,
        }],
      };
    }

    const { workflows, credentialTransform } = prepareResult;

    // Dry Run 모드
    if (opts.dryRun) {
      return {
        success: true,
        timestamp,
        sourceEnv: target.sourceEnv,
        targetEnv: target.targetEnv,
        workflows: workflows.map((w) => ({
          workflowId: w.id,
          workflowName: w.name,
          targetId: '(dry-run)',
          action: 'skipped' as const,
          credentialsTransformed: 0,
        })),
        summary: {
          total: workflows.length,
          created: 0,
          updated: 0,
          skipped: workflows.length,
          failed: 0,
        },
        errors: [],
      };
    }

    // 3-4. 각 워크플로우에 대해 transform → deploy
    for (const workflow of workflows) {
      try {
        // credential 변환
        const { workflow: transformed, transformedCount } = this.transformCredentials(
          workflow,
          credentialTransform
        );

        // 배포
        const deployed = await this.deploy(transformed, transformedCount, opts);
        deployedWorkflows.push(deployed);

        // 5. 검증 (skipped가 아닌 경우만)
        if (deployed.action !== 'skipped') {
          const verified = await this.verify(deployed.targetId);
          if (!verified) {
            errors.push({
              workflowId: workflow.id,
              workflowName: workflow.name,
              phase: 'verify',
              message: `배포 후 확인 실패: 대상 환경에서 워크플로우를 찾을 수 없습니다`,
            });
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push({
          workflowId: workflow.id,
          workflowName: workflow.name,
          phase: 'deploy',
          message: msg,
        });
      }
    }

    // 요약 생성
    const summary: DeploymentSummary = {
      total: workflows.length,
      created: deployedWorkflows.filter((w) => w.action === 'created').length,
      updated: deployedWorkflows.filter((w) => w.action === 'updated').length,
      skipped: deployedWorkflows.filter((w) => w.action === 'skipped').length,
      failed: errors.length,
    };

    return {
      success: errors.length === 0,
      timestamp,
      sourceEnv: target.sourceEnv,
      targetEnv: target.targetEnv,
      workflows: deployedWorkflows,
      summary,
      errors,
    };
  }
}
