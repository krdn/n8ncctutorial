# Summary 04-02: 수동 백업 명령어

## Status: COMPLETED

## Tasks Completed

### Task 1: 백업 실행 모듈 구현
- **File**: `src/backup/backup.ts`
- **Commit**: `830fba3`
- **Description**:
  - `createBackup()`: 전체/필터링된 워크플로우 백업 수행
  - `createSelectiveBackup()`: 특정 ID의 워크플로우만 백업
  - 매니페스트 자동 생성 및 저장
  - 진행 상황 콜백(ProgressCallback) 지원

### Task 2: 백업 CLI 명령어 구현
- **File**: `src/cli/commands/backup.ts`
- **Commit**: `43a12a4`
- **Description**:
  - `n8n-wfm backup` 명령어 구현
  - 옵션: `-o, --output`, `-e, --env`, `-c, --config`, `--keep-credentials`, `--active-only`, `--ids`, `--description`
  - 실시간 진행 상황 표시
  - 성공/실패 결과 요약 출력

### Task 3: 백업 모듈 인덱스 업데이트
- **File**: `src/backup/index.ts`
- **Commit**: `630816a`
- **Description**:
  - `createBackup`, `createSelectiveBackup` 함수 재내보내기 추가

### Task 4: CLI 명령어 등록
- **File**: `src/cli/commands/index.ts`
- **Commit**: `82b2df9`
- **Description**:
  - `registerBackupCommand` import 및 등록
  - backup 명령어 활성화

### Task 5: 빌드 및 CLI 검증
- **Status**: PASSED
- **Verification**:
  - `npm run build`: 성공
  - `node dist/index.js backup --help`: 정상 출력 확인

## CLI Usage

```bash
# 전체 워크플로우 백업
n8n-wfm backup

# 활성화된 워크플로우만 백업
n8n-wfm backup --active-only

# 특정 ID들만 백업
n8n-wfm backup --ids "123,456,789"

# 설명 메모 추가
n8n-wfm backup --description "Daily backup"

# 출력 디렉토리 지정
n8n-wfm backup -o ./my-backups

# credentials 유지
n8n-wfm backup --keep-credentials
```

## Files Modified
- `src/backup/backup.ts` (created)
- `src/cli/commands/backup.ts` (created)
- `src/backup/index.ts` (modified)
- `src/cli/commands/index.ts` (modified)

## Deviations
- None

## Dependencies Used
- 04-01의 `generateBackupId`, `createBackupDirectory`, `writeManifest` 함수 활용
- workflow 모듈의 `bulkExportWorkflows`, `exportWorkflows`, `ProgressCallback` 활용
