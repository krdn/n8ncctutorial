# 06-03 Summary: 자동 커밋 및 변경 이력

## 완료된 작업

### Task 1: 자동 커밋 타입 및 함수 구현
- `src/version/types.ts`에 타입 추가:
  - `AutoCommitOptions`: message (optional), includeUntracked (default: true)
  - `AutoCommitResult`: success, hash, message, changedFiles
  - `HistoryOptions`: limit, workflowId

- `src/version/commit.ts` 생성:
  - `generateCommitMessage(changes)`: 변경 내용 기반 커밋 메시지 자동 생성
    - 예: "backup: 3 workflow(s) updated (My Workflow, Test Flow, ...)"
    - 추가/수정/삭제 구분하여 메시지 생성
    - 최대 3개 워크플로우 이름 표시, 나머지는 "... and N more"
  - `autoCommit(repoPath, options?)`: 자동 커밋 수행
    - `detectChanges()`로 변경 감지
    - 변경 없으면 early return (success: true, hash: null)
    - `stageFiles()`로 스테이징
    - `commitChanges()`로 커밋
    - `AutoCommitResult` 반환
  - `getHistory(repoPath, options?)`: 커밋 이력 조회
    - limit: 조회할 개수 (기본 20)
    - workflowId: 특정 워크플로우 관련 커밋만 필터

### Task 2: version commit CLI 명령어 추가
- `src/cli/commands/version.ts`에 commit 하위 명령어 추가:
  - `n8n-wfm version commit [path]` - 변경 사항 커밋
    - `-m, --message <msg>`: 커밋 메시지 (생략 시 자동 생성)
    - `--dry-run`: 실제 커밋 없이 변경 사항만 표시
    - 커밋 성공 시 해시와 변경 파일 수 출력

- version log 명령어 개선:
  - `-w, --workflow <id>`: 특정 워크플로우 관련 커밋만 필터
  - 커밋 해시 (7자리), 날짜, 메시지 표시

### Task 3: version 모듈 인덱스 업데이트
- `src/version/index.ts` 수정:
  - commit.ts에서 함수 재내보내기:
    - `generateCommitMessage`
    - `autoCommit`
    - `getHistory`
  - 새 타입 재내보내기:
    - `AutoCommitOptions`
    - `AutoCommitResult`
    - `HistoryOptions`

## 생성/수정된 파일

### 새로 생성된 파일
- `src/version/commit.ts` - 자동 커밋 모듈 (약 190줄)

### 수정된 파일
- `src/version/types.ts` - 자동 커밋 관련 타입 추가
- `src/version/index.ts` - commit 함수 재내보내기 추가
- `src/cli/commands/version.ts` - commit 명령어 추가, log 명령어 개선

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
$ node dist/index.js version commit --help
Usage: n8n-wfm version commit [options] [path]

변경 사항 커밋

Options:
  -c, --config <path>  설정 파일 경로 지정
  -m, --message <msg>  커밋 메시지 (생략 시 자동 생성)
  --dry-run            실제 커밋 없이 변경 사항만 표시
  -h, --help           display help for command
```

## 새로 추가된 API

```typescript
// 타입
import type {
  AutoCommitOptions,
  AutoCommitResult,
  HistoryOptions,
} from './version/index.js';

// 함수
import {
  generateCommitMessage,  // 변경 기반 커밋 메시지 자동 생성
  autoCommit,             // 자동 커밋 수행
  getHistory,             // 커밋 이력 조회 (필터링 지원)
} from './version/index.js';
```

## 사용 예시

### 자동 커밋 (메시지 자동 생성)
```bash
n8n-wfm version commit
```

### 커밋 메시지 직접 지정
```bash
n8n-wfm version commit -m "feat: 새 알림 워크플로우 추가"
```

### 변경 사항 미리보기 (dry-run)
```bash
n8n-wfm version commit --dry-run
```

### 특정 워크플로우 커밋 이력 조회
```bash
n8n-wfm version log --workflow "My Workflow"
```

## 커밋 메시지 형식

### 단일 유형 변경
```
backup: 2 workflow(s) updated (Email Notification, Slack Alert)
```

### 복합 변경
```
backup: 5 workflows changed

2 workflow(s) added (New Flow 1, New Flow 2)
2 workflow(s) updated (Existing Flow 1, Existing Flow 2)
1 workflow(s) deleted (Removed Flow)
```

## 주의사항

- `autoCommit`은 변경 없을 때 `hash: null`을 반환 (에러 아님)
- `includeUntracked: false`로 설정하면 새 파일은 커밋에서 제외
- `getHistory`의 워크플로우 필터는 커밋 메시지 기반으로 동작
- 워크플로우 이름이 길면 최대 3개까지만 표시되고 나머지는 생략

## Phase 6 완료

이 플랜(06-03)으로 Phase 6 Version Control이 완료되었습니다.

구현된 전체 기능:
- 06-01: Git 저장소 초기화 및 연동 (init, status, log)
- 06-02: 워크플로우 변경 감지 (detectChanges)
- 06-03: 자동 커밋 및 변경 이력 (commit, log 개선)
- 06-04: 워크플로우 diff 보기 (diff)
