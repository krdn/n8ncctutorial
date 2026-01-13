# 06-04 Summary: 워크플로우 diff 보기

## 완료된 작업

### Task 1: diff 타입 정의 및 모듈 구현
- `src/version/types.ts`에 diff 관련 타입 추가:
  - `NodeChangeType`: 노드 변경 유형 (`'added' | 'removed' | 'modified'`)
  - `ConnectionChangeType`: 연결 변경 유형 (`'added' | 'removed'`)
  - `NodeDiff`: 개별 노드의 변경 정보
    - nodeId, nodeName, nodeType, changeType, details (수정된 경우)
  - `ConnectionDiff`: 노드 간 연결의 변경 정보
    - from, to, changeType
  - `WorkflowDiff`: 두 워크플로우 버전 간 차이점 정보
    - workflowId, workflowName, nodes, connections, settingsChanged, summary

- `src/version/diff.ts` 생성:
  - `compareWorkflows(oldWorkflow, newWorkflow)`: 두 워크플로우 JSON 비교
    - 노드 비교: ID 기준 추가/삭제/수정 판별
    - 연결 비교: source-target 쌍 기준 비교
    - 설정 변경 여부 확인
    - 요약 정보 계산 (추가/삭제/수정 개수)
  - `getWorkflowAtCommit(repoPath, filePath, commitHash)`: 특정 커밋의 워크플로우 조회
    - git show 명령어로 과거 버전 읽기
    - 파일이 없는 경우 `null` 반환
  - `readWorkflowFile(filePath)`: 현재 작업 디렉토리의 워크플로우 파일 읽기
  - `formatDiff(diff, options)`: diff 결과를 사람이 읽기 쉬운 문자열로 변환
    - 노드 추가: "+ [노드타입] 노드이름"
    - 노드 삭제: "- [노드타입] 노드이름"
    - 노드 수정: "~ [노드타입] 노드이름: 변경 내용"
    - verbose 모드: 상세 변경 내용 표시
  - `formatDiffAsJson(diff)`: diff 결과를 JSON 문자열로 반환

### Task 2: version diff CLI 명령어 추가
- `src/cli/commands/version.ts`에 diff 하위 명령어 추가:
  - `n8n-wfm version diff <file>` - 워크플로우 변경 내용 비교
  - 옵션:
    - `-c, --config <path>`: 설정 파일 경로 지정
    - `-p, --path <path>`: 저장소 경로 지정
    - `--commit <hash>`: 특정 커밋과 비교
    - `--commits <hashes>`: 두 커밋 간 비교 (hash1,hash2 형식)
    - `-s, --summary`: 요약만 표시 (노드 추가/삭제 개수)
    - `--json`: JSON 형식으로 출력
    - `-v, --verbose`: 상세 변경 내용 표시
  - 비교 모드:
    - 기본: HEAD와 현재 working directory 비교
    - `--commit`: 특정 커밋과 현재 파일 비교
    - `--commits`: 두 커밋 간 비교

### Task 3: version 모듈 인덱스 업데이트
- `src/version/index.ts` 수정:
  - diff.ts에서 함수 재내보내기:
    - `compareWorkflows`
    - `getWorkflowAtCommit`
    - `readWorkflowFile`
    - `formatDiff`
    - `formatDiffAsJson`
  - types.ts에서 새 타입 재내보내기 (이미 06-02에서 추가됨):
    - `NodeChangeType`
    - `ConnectionChangeType`
    - `NodeDiff`
    - `ConnectionDiff`
    - `WorkflowDiff`

## 생성/수정된 파일

### 새로 생성된 파일
- `src/version/diff.ts` - 워크플로우 diff 모듈 (약 350줄)

### 수정된 파일
- `src/version/types.ts` - diff 관련 타입 추가 (NodeDiff, ConnectionDiff, WorkflowDiff)
- `src/version/index.ts` - diff 함수 재내보내기 추가
- `src/cli/commands/version.ts` - diff 하위 명령어 추가 (약 150줄)

## 검증 결과

### 빌드 결과
```
$ npm run build
> n8n-workflow-manager@0.1.0 build
> tsc
(성공)
```

### CLI 명령어 확인
```
$ node dist/index.js version --help
Usage: n8n-wfm version [options] [command]

워크플로우 버전 관리 (Git)

Commands:
  init [options] [path]  Git 저장소 초기화
  status [options]       저장소 상태 확인
  log [options]          커밋 이력 조회
  diff [options] <file>  워크플로우 변경 내용 비교
  help [command]         display help for command
```

```
$ node dist/index.js version diff --help
Usage: n8n-wfm version diff [options] <file>

워크플로우 변경 내용 비교

Options:
  -c, --config <path>  설정 파일 경로 지정
  -p, --path <path>    저장소 경로 지정
  --commit <hash>      특정 커밋과 비교
  --commits <hashes>   두 커밋 간 비교 (hash1,hash2 형식)
  -s, --summary        요약만 표시
  --json               JSON 형식으로 출력
  -v, --verbose        상세 변경 내용 표시
  -h, --help           display help for command
```

## 새로 추가된 API

```typescript
// 타입
import type {
  NodeChangeType,
  ConnectionChangeType,
  NodeDiff,
  ConnectionDiff,
  WorkflowDiff,
} from './version/index.js';

// 함수
import {
  compareWorkflows,      // 두 워크플로우 JSON 비교
  getWorkflowAtCommit,   // 특정 커밋의 워크플로우 조회
  readWorkflowFile,      // 현재 파일 읽기
  formatDiff,            // 사람이 읽기 쉬운 형식으로 변환
  formatDiffAsJson,      // JSON 형식으로 변환
} from './version/index.js';
```

## 사용 예시

### 기본 사용 (HEAD vs working directory)
```bash
n8n-wfm version diff workflow_123.json
```

### 특정 커밋과 비교
```bash
n8n-wfm version diff workflow_123.json --commit abc1234
```

### 두 커밋 간 비교
```bash
n8n-wfm version diff workflow_123.json --commits abc1234,def5678
```

### 요약만 표시
```bash
n8n-wfm version diff workflow_123.json --summary
```

### JSON 형식으로 출력
```bash
n8n-wfm version diff workflow_123.json --json
```

### 상세 변경 내용 표시
```bash
n8n-wfm version diff workflow_123.json --verbose
```

## 주의사항

- `getWorkflowAtCommit`은 파일이 해당 커밋에 존재하지 않으면 `null` 반환
- 비교 시 새 파일인 경우 "New file (no previous version)" 메시지 표시
- 삭제된 파일인 경우 "File deleted (no current version)" 메시지 표시
- 노드 비교는 ID 기준, 연결 비교는 "from->to" 쌍 기준
- 위치(position) 변경도 수정으로 감지됨

## 다음 단계

이 기능은 다음과 같이 활용될 수 있습니다:
- 백업 전후 변경 내용 확인
- 특정 시점의 워크플로우 비교
- CI/CD 파이프라인에서 변경 검증
- 코드 리뷰 시 변경 내용 파악
