# 06-02 Summary: 워크플로우 변경 감지

## 완료된 작업

### Task 1: 변경 감지 타입 확장
- `src/version/types.ts`에 변경 감지 관련 타입 추가:
  - `ChangeType`: 변경 유형 (`'added' | 'modified' | 'deleted'`)
  - `WorkflowChange`: 개별 워크플로우 파일의 변경 정보
    - workflowId, workflowName, filePath, changeType
  - `ChangeDetectionResult`: 전체 변경 감지 결과
    - changes, hasChanges, timestamp
  - `WorkflowSummary`: 워크플로우 요약 정보
    - id, name, nodeCount, active, tags

### Task 2: 변경 감지 모듈 구현
- `src/version/watch.ts` 생성:
  - `detectChanges(repoPath)`: Git status 기반 변경 감지
    - `getRepoStatus()` 호출로 modified, untracked, staged 파일 목록 획득
    - `.json` 파일만 필터링 (워크플로우 파일)
    - `manifest.json` 파일 제외
    - `WorkflowChange` 배열로 변환하여 반환
  - `parseWorkflowFromFile(filePath)`: 워크플로우 JSON 파일 읽기
    - 파일 존재 여부 확인
    - JSON 파싱 및 기본 검증 (id 또는 name 필드 확인)
  - `getWorkflowSummary(workflow)`: 워크플로우 요약 정보 추출
    - ID, 이름, 노드 개수, 활성화 상태, 태그 반환

### Task 3: version 모듈 인덱스 업데이트
- `src/version/index.ts` 수정:
  - watch.ts에서 함수 재내보내기:
    - `detectChanges`
    - `parseWorkflowFromFile`
    - `getWorkflowSummary`
  - types.ts에서 새 타입 재내보내기:
    - `ChangeType`
    - `WorkflowChange`
    - `ChangeDetectionResult`
    - `WorkflowSummary`

### 부가 작업: Diff 모듈 stub 구현
- `src/version/diff.ts` 생성 (기존 CLI 코드 호환을 위한 stub 구현):
  - `readWorkflowFile(filePath)`: 워크플로우 JSON 파일 읽기
  - `getWorkflowAtCommit(repoPath, filePath, commitHash)`: 특정 커밋의 워크플로우 가져오기
  - `compareWorkflows(oldWorkflow, newWorkflow)`: 두 워크플로우 비교
  - `formatDiff(diff, options?)`: diff 결과 텍스트 포맷팅
  - `formatDiffAsJson(diff)`: diff 결과 JSON 포맷팅
- 이 모듈은 기본적인 비교 기능을 제공하며, 향후 06-03에서 고급 기능으로 확장 예정

## 생성/수정된 파일

### 새로 생성된 파일
- `src/version/watch.ts` - 워크플로우 변경 감지 모듈
- `src/version/diff.ts` - 워크플로우 비교 모듈 (stub 구현)

### 수정된 파일
- `src/version/types.ts` - 변경 감지 관련 타입 추가
- `src/version/index.ts` - 새 타입 및 함수 재내보내기 추가

## 검증 결과

### 빌드 결과
```
$ npm run build
> n8n-workflow-manager@0.1.0 build
> tsc
(성공)
```

### 새로 추가된 API
```typescript
// 타입
import type {
  ChangeType,
  WorkflowChange,
  ChangeDetectionResult,
  WorkflowSummary,
} from './version/index.js';

// 함수
import {
  detectChanges,        // Git status 기반 변경 감지
  parseWorkflowFromFile,// JSON 파일 파싱
  getWorkflowSummary,   // 워크플로우 요약 정보
} from './version/index.js';
```

## 다음 단계 참고

### 06-03에서 사용할 API
- `detectChanges(repoPath)` - 백업 후 변경된 파일 목록 확인
- `getWorkflowSummary(workflow)` - 변경 내용 요약 표시

### 주의사항
- `detectChanges`는 Git 저장소가 아닌 경우 빈 결과 반환 (`hasChanges: false`)
- `parseWorkflowFromFile`은 파일이 없거나 파싱 실패 시 `null` 반환
- `manifest.json` 파일은 워크플로우가 아니므로 감지 결과에서 제외

### 확장 가능성
- 삭제된 파일(`deleted`) 감지는 Git staged 파일에서 처리
- 향후 `compareWorkflows`, `formatDiff` 등 비교 기능 구현 시 활용 가능
- 실시간 파일 시스템 감시(watch mode)로 확장 가능
