# Plan 05-03: 선택적 워크플로우 복원 - Summary

## Overview
백업에서 특정 워크플로우만 선택하여 복원하는 기능을 구현했습니다. 전체 복원 대신 필요한 워크플로우만 선택적으로 복원할 수 있습니다.

## Completed Tasks

### Task 1: 선택적 복원 함수 구현
- **File**: `src/restore/restore.ts`
- **Changes**:
  - `findWorkflowInBackup(backupDir, idOrName, matchByName)`: 백업에서 워크플로우 검색
    - ID 또는 이름으로 검색 지원
    - 매니페스트의 workflows 배열에서 검색
  - `restoreSelectiveBackup(client, backupDir, workflowIdentifiers, options)`: 선택적 복원
    - workflowIdentifiers: 복원할 워크플로우 ID 또는 이름 배열
    - 매니페스트에서 해당 워크플로우만 필터링
    - 존재하지 않는 워크플로우 ID는 경고 후 건너뛰기
    - RestoreResult 반환
- **Commit**: fe7c3ec

### Task 2: 복원 타입 확장
- **File**: `src/restore/types.ts`
- **Changes**:
  - `SelectiveRestoreOptions` 인터페이스 추가
    - `workflowIds: string[]` - 복원할 워크플로우 ID 또는 이름 목록
    - `matchByName: boolean` - 이름으로 매칭 허용 여부 (기본: true)
- **Commit**: bb0bf0b

### Task 3: restore 모듈 인덱스 업데이트
- **File**: `src/restore/index.ts`
- **Changes**:
  - `findWorkflowInBackup` 함수 export 추가
  - `restoreSelectiveBackup` 함수 export 추가
  - `SelectiveRestoreOptions` 타입 export 추가
- **Commit**: def6f4e

### Task 4: restore 명령어 확장
- **File**: `src/cli/commands/restore.ts`
- **Changes**:
  - `--ids <ids>` 옵션 추가 - 복원할 워크플로우 ID 목록 (콤마 구분)
  - `--names <names>` 옵션 추가 - 복원할 워크플로우 이름 목록 (콤마 구분)
  - 옵션 없으면 전체 복원, 있으면 선택적 복원
  - dry-run에서 선택된 워크플로우만 표시
  - TODO 주석: --interactive 옵션 (향후 inquirer 활용 확장)
- **Commit**: 5c3e655

### Task 5: 빌드 및 CLI 검증
- **Verification**:
  - `npm run build` 성공
  - `node dist/index.js restore run --help`에서 --ids, --names 옵션 확인
- **Fix Commit**: 21b98f2 (타입명 수정: BackupWorkflowInfo)

## Verification Results
- [x] `npm run build` 성공
- [x] `node dist/index.js restore run --help`에 --ids, --names 옵션 표시
- [x] restoreSelectiveBackup 함수 구현 완료
- [x] findWorkflowInBackup 함수 구현 완료
- [x] --ids 옵션으로 특정 워크플로우만 복원 가능
- [x] 존재하지 않는 ID 지정 시 경고 메시지 출력

## CLI Usage Examples

```bash
# 전체 복원 (기존 방식)
n8n-wfm restore run 20250114_120000

# 특정 ID로 선택적 복원
n8n-wfm restore run 20250114_120000 --ids "1,2,5"

# 특정 이름으로 선택적 복원
n8n-wfm restore run 20250114_120000 --names "My Workflow,Test Flow"

# ID와 이름 혼합 선택적 복원
n8n-wfm restore run 20250114_120000 --ids "1,2" --names "Test Flow"

# dry-run으로 선택적 복원 미리보기
n8n-wfm restore run 20250114_120000 --ids "1,2" --dry-run
```

## Files Modified
- `src/restore/restore.ts` - 선택적 복원 함수 추가
- `src/restore/types.ts` - SelectiveRestoreOptions 타입 추가
- `src/restore/index.ts` - 새 함수/타입 export
- `src/cli/commands/restore.ts` - CLI 옵션 추가

## Notes
- 백업의 워크플로우 ID와 n8n의 워크플로우 ID가 다를 수 있음 (새 환경 복원 시)
- 이름으로 검색 시 중복 이름 처리: 첫 번째 매칭 사용
- interactive 모드는 향후 확장으로 미루고 TODO 주석 추가
- 선택적 복원은 백업에서 일부 워크플로우만 필요할 때 유용

## Deviations
- 없음 (플랜대로 구현)
