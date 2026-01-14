# Phase 08-05: 배포 CLI 명령어 구현 완료

## 완료 일시
2026-01-14

## 구현 내용

### 1. deploy 명령어 그룹 (src/cli/commands/deploy.ts)

#### deploy run <source> <target>
환경 간 워크플로우 배포 명령어

**옵션:**
| 옵션 | 설명 |
|------|------|
| `-c, --config <path>` | 설정 파일 경로 |
| `-w, --workflows <ids>` | 특정 워크플로우 ID (쉼표 구분) |
| `--dry-run` | 시뮬레이션 모드 (실제 배포 없음) |
| `--no-backup` | 배포 전 백업 생략 |
| `--activate` | 배포 후 워크플로우 활성화 |
| `--force` | 기존 워크플로우 강제 덮어쓰기 |

**사용 예시:**
```bash
# 전체 배포
n8n-wfm deploy run dev prod

# 특정 워크플로우만 배포
n8n-wfm deploy run dev prod --workflows "wf1,wf2"

# 시뮬레이션 모드
n8n-wfm deploy run dev prod --dry-run

# 백업 없이 강제 배포
n8n-wfm deploy run dev prod --no-backup --force
```

#### deploy status
배포 이력 조회

**옵션:**
| 옵션 | 설명 |
|------|------|
| `-l, --limit <n>` | 표시할 최대 개수 (기본: 10) |
| `-e, --env <name>` | 특정 환경 필터 |

**사용 예시:**
```bash
# 최근 배포 이력 조회
n8n-wfm deploy status

# prod 환경 관련 배포만 조회
n8n-wfm deploy status --env prod
```

#### deploy rollback [deployment-id]
이전 배포 상태로 롤백

**옵션:**
| 옵션 | 설명 |
|------|------|
| `-c, --config <path>` | 설정 파일 경로 |
| `-w, --workflows <ids>` | 특정 워크플로우만 롤백 |
| `-y, --yes` | 확인 없이 롤백 실행 |

**사용 예시:**
```bash
# 가장 최근 배포 롤백
n8n-wfm deploy rollback --yes

# 특정 배포 롤백
n8n-wfm deploy rollback 2026-01-14T10-30-00-000Z --yes
```

#### deploy diff <source> <target>
환경 간 워크플로우 차이 비교

**사용 예시:**
```bash
# dev와 prod 환경 비교
n8n-wfm deploy diff dev prod
```

### 2. CLI 통합 (src/cli/commands/index.ts)
- `registerDeployCommand` 함수 등록
- 기존 명령어들과 함께 deploy 명령어 그룹 추가

## 수정된 파일
1. `src/cli/commands/deploy.ts` (신규) - 배포 CLI 명령어
2. `src/cli/commands/index.ts` (수정) - deploy 명령어 등록

## 검증 결과

### 빌드 검증
```
npm run build 성공
```

### CLI 도움말 검증
```bash
node dist/index.js deploy --help
node dist/index.js deploy run --help
node dist/index.js deploy status --help
node dist/index.js deploy rollback --help
node dist/index.js deploy diff --help
```
모든 명령어 도움말 정상 출력 확인

## 커밋
- `feat(08-05): 배포 CLI 명령어 구현`

## Phase 8 완료
Phase 8 Deployment Core의 모든 플랜이 완료되었습니다:
- 08-01: 배포 타입 정의 및 파이프라인 설계
- 08-02: Credential 변환 유틸리티
- 08-03: 배포 검증 유틸리티
- 08-04: 롤백 기능 구현
- 08-05: 배포 CLI 명령어 (완료)
