# Plan 05-02 Summary: 특정 백업 복원

## Overview
특정 백업 ID를 지정하여 해당 백업의 모든 워크플로우를 n8n 인스턴스로 복원하는 기능을 구현했습니다. workflow/import.ts의 importWorkflow 함수를 활용하여 중복 구현을 방지했습니다.

## Completed Tasks

### Task 1: 복원 실행 모듈 구현
- **파일**: `src/restore/restore.ts` (신규 생성)
- **변경 사항**:
  - `restoreBackup(client, backupDir, options, onProgress)`: 백업 전체 복원 함수
  - `previewRestore(backupDir, options)`: dry-run용 복원 계획 미리보기
  - `findBackupPath(baseDir, backupId)`: 백업 ID로 디렉토리 경로 찾기
  - `RestoreProgressCallback` 타입: 진행 상황 콜백 지원
  - `mapRestoreModeToImportMode`: RestoreMode → ImportMode 변환
- **커밋**: `96162cc`

### Task 2: restore 타입 확장
- **파일**: `src/restore/types.ts` (수정)
- **변경 사항**:
  - `RestoreOptions.continueOnError` 필드 추가 (기본값: true)
  - restoreBackup 함수에서 continueOnError 로직 구현
- **커밋**: `0d3e162`

### Task 3: restore 모듈 인덱스 업데이트
- **파일**: `src/restore/index.ts` (수정)
- **변경 사항**:
  - `restoreBackup` 함수 재내보내기
  - `previewRestore` 함수 재내보내기
  - `findBackupPath` 함수 재내보내기
  - `DEFAULT_RESTORE_OPTIONS` 상수 재내보내기
  - `RestoreProgressCallback` 타입 재내보내기
- **커밋**: `549e7fc`

### Task 4: restore 명령어에 복원 기능 추가
- **파일**: `src/cli/commands/restore.ts` (수정)
- **변경 사항**:
  - `restore run <backupId>` 하위 명령어 구현
  - 옵션: `-e/--env`, `-c/--config`, `-d/--dir`, `--mode`, `--activate`, `--dry-run`, `--json`
  - dry-run 모드: 실제 복원 없이 복원 계획 표시
  - 진행 상황 출력 콜백 (+/-/x 심볼로 상태 표시)
  - 결과 요약 출력 (성공/실패/건너뛰기 개수, 소요 시간)
  - credentials 수동 설정 안내 메시지
- **커밋**: `854f220`

### Task 5: 빌드 및 CLI 검증
- **파일**: `src/cli/commands/restore.ts` (수정)
- **변경 사항**:
  - config import 중복 제거 및 통합
  - createClient 호출 시 EnvironmentConfig 직접 전달
  - 환경 결정 로직 에러 처리 개선
- **검증 결과**:
  - `npm run build` 성공
  - `node dist/index.js restore run --help` 정상 출력
- **커밋**: `1100c9c`

## Files Modified
- `src/restore/restore.ts` (신규)
- `src/restore/types.ts` (수정)
- `src/restore/index.ts` (수정)
- `src/cli/commands/restore.ts` (수정)

## CLI Usage Examples

```bash
# 복원 계획 미리보기 (dry-run)
n8n-wfm restore run 20250114_120000 --dry-run

# 기본 모드(overwrite)로 복원
n8n-wfm restore run 20250114_120000

# 특정 환경에 복원
n8n-wfm restore run 20250114_120000 -e production

# 복원 후 워크플로우 활성화
n8n-wfm restore run 20250114_120000 --activate

# skip 모드로 복원 (기존 워크플로우 건너뛰기)
n8n-wfm restore run 20250114_120000 --mode skip

# JSON 출력
n8n-wfm restore run 20250114_120000 --json
```

## Verification Results
- [x] `npm run build` 성공
- [x] `node dist/index.js restore run --help` 정상 출력
- [x] restoreBackup 함수 구현 완료
- [x] --dry-run 옵션으로 복원 대상 워크플로우 목록 확인
- [x] 진행 상황 콜백 연동

## Notes
- workflow/import.ts의 importWorkflow를 활용하여 중복 구현 방지
- overwrite 모드가 기본 - 기존 워크플로우가 있으면 업데이트, 없으면 생성
- credentials는 백업 시 제거되었으므로 복원 후 수동 설정 안내 제공
- dry-run은 실제 API 호출 없이 복원 계획만 출력

## Deviations
- 없음
