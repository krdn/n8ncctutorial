# Phase 03-01 Summary: 워크플로우 내보내기 기능 구현

## 완료일: 2026-01-14

## 목표
n8n 워크플로우를 JSON 파일로 내보내는 기능 구현

## 구현 내용

### Task 1: Export 모듈 구현

**파일: `src/workflow/export.ts`**

인터페이스 정의:
- `ExportOptions`: outputDir, stripCredentials, prettyPrint
- `ExportResult`: workflowId, workflowName, filePath, success, error

주요 함수:
- `sanitizeFilename(name)`: 파일명 안전 문자 처리
- `stripCredentialsFromWorkflow(workflow)`: credentials 정보 제거
- `exportWorkflow(client, id, options)`: 단일 워크플로우 내보내기
- `exportWorkflows(client, ids, options)`: 복수 워크플로우 일괄 내보내기
- `exportAllWorkflows(client, options)`: 전체 워크플로우 내보내기

**파일: `src/workflow/index.ts`**
- export 모듈 re-export

### Task 2: CLI export 명령어 구현

**파일: `src/cli/commands/export.ts`**

명령어: `export <workflow-id>`

옵션:
- `-o, --output <dir>`: 출력 디렉토리 (기본: ./exports)
- `-e, --env <name>`: 환경 지정
- `-c, --config <path>`: 설정 파일 경로 지정
- `--keep-credentials`: credentials 유지 (기본: 제거)

**파일: `src/cli/commands/index.ts`**
- registerExportCommand 등록

## 검증 결과

- [x] `npm run build` 성공
- [x] `node dist/index.js export --help` 도움말 표시
- [x] export 모듈 타입 정의됨
- [x] sanitizeFilename 함수 구현됨

## 사용 예시

```bash
# 기본 내보내기 (credentials 제거)
n8n-wfm export abc123

# 출력 디렉토리 지정
n8n-wfm export abc123 -o ./backups

# 특정 환경에서 내보내기
n8n-wfm export abc123 -e production

# credentials 유지하여 내보내기
n8n-wfm export abc123 --keep-credentials
```

## 생성된 파일

| 파일 | 설명 |
|------|------|
| `src/workflow/export.ts` | 워크플로우 내보내기 핵심 로직 |
| `src/workflow/index.ts` | workflow 모듈 진입점 |
| `src/cli/commands/export.ts` | CLI export 명령어 |

## 수정된 파일

| 파일 | 변경 사항 |
|------|----------|
| `src/cli/commands/index.ts` | registerExportCommand 등록 |

## 다음 단계

- 03-02: 워크플로우 가져오기 기능 구현 (import 명령어)
