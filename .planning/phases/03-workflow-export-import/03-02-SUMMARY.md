# Phase 03-02 Summary: 워크플로우 가져오기 기능 구현

## 완료일: 2026-01-14

## 목표
JSON 파일에서 워크플로우를 n8n 인스턴스로 가져오는 기능 구현

## 구현 내용

### Task 1: Import 모듈 구현

**파일: `src/workflow/import.ts`**

인터페이스 정의:
- `ImportOptions`: mode ('create' | 'update' | 'upsert'), activate (boolean)
- `ImportResult`: workflowId, workflowName, action, success, error

주요 함수:
- `validateWorkflowJson(data)`: 워크플로우 JSON 필수 필드 검증 (name, nodes, connections)
- `findWorkflowByName(client, name)`: 이름으로 기존 워크플로우 검색
- `importWorkflow(client, filePath, options)`: JSON 파일에서 워크플로우 가져오기

가져오기 모드:
- `create`: 새 워크플로우로 생성 (ID 무시)
- `update`: 기존 워크플로우 업데이트 (ID 필수)
- `upsert`: 이름으로 검색하여 있으면 update, 없으면 create

**파일: `src/workflow/index.ts`**
- import 모듈 re-export 추가

### Task 2: CLI import 명령어 구현

**파일: `src/cli/commands/import.ts`**

명령어: `import <file>`

옵션:
- `-e, --env <name>`: 환경 지정
- `-c, --config <path>`: 설정 파일 경로 지정
- `-m, --mode <mode>`: 가져오기 모드 (create/update/upsert, 기본: create)
- `--activate`: 가져온 후 활성화

에러 처리:
- 파일 미존재: "File not found: {path}"
- 잘못된 JSON: "Invalid JSON file"
- 잘못된 워크플로우 구조: "Invalid workflow format: missing {field}"
- update 모드에서 ID 누락: "Update mode requires workflow ID in JSON file"

**파일: `src/cli/commands/index.ts`**
- registerImportCommand 등록

## 검증 결과

- [x] `npm run build` 성공
- [x] `node dist/index.js import --help` 도움말 표시
- [x] import 명령어가 CLI에 정상 등록됨
- [x] 3가지 모드(create/update/upsert) 지원

## 사용 예시

```bash
# 기본 가져오기 (create 모드)
n8n-wfm import ./workflows/my-workflow.json

# 특정 환경으로 가져오기
n8n-wfm import ./workflows/my-workflow.json -e production

# upsert 모드로 가져오기 (있으면 업데이트, 없으면 생성)
n8n-wfm import ./workflows/my-workflow.json -m upsert

# 가져온 후 활성화
n8n-wfm import ./workflows/my-workflow.json --activate

# 조합 사용
n8n-wfm import ./workflows/my-workflow.json -e production -m upsert --activate
```

## 생성된 파일

| 파일 | 설명 |
|------|------|
| `src/workflow/import.ts` | 워크플로우 가져오기 핵심 로직 |
| `src/cli/commands/import.ts` | CLI import 명령어 |

## 수정된 파일

| 파일 | 변경 사항 |
|------|----------|
| `src/workflow/index.ts` | import 모듈 re-export 추가 |
| `src/cli/commands/index.ts` | registerImportCommand 등록 |

## 다음 단계

- 03-03: 일괄 내보내기/가져오기 기능 구현 (export-all, import-all)
