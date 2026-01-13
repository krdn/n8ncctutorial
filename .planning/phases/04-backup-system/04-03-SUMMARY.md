# Summary 04-03: 스케줄 백업 (cron 연동)

## Overview
자동화된 스케줄 백업을 위한 cron 표현식 지원과 백업 보관 정책(retention)을 구현했습니다. 시스템 cron과 연동할 수 있는 형태로 구성하여 간단하고 안정적인 자동 백업 환경을 제공합니다.

## Completed Tasks

### Task 1: 백업 보관 정책 구현
- **파일**: `src/backup/retention.ts`
- **구현 내용**:
  - `cleanupOldBackups(baseDir, keepCount)`: keepCount 개수를 초과하는 오래된 백업 자동 삭제
  - `getBackupStats(baseDir)`: 백업 통계 조회 (개수, 용량, 날짜, 환경별 집계)
  - `previewCleanup(baseDir, keepCount)`: 삭제 미리보기 기능
  - `formatBytes(bytes)`: 사람이 읽기 쉬운 용량 표시 유틸리티

### Task 2: 스케줄 백업 설정 타입 추가
- **파일**: `src/backup/types.ts`
- **추가 타입**:
  - `ScheduleConfig`: cron 표현식 및 활성화 설정
  - `RetentionConfig`: 보관 개수 및 자동 정리 설정
  - `BackupOptionsWithRetention`: 확장된 백업 옵션 인터페이스

### Task 3: backup 명령어에 retention 옵션 추가
- **파일**: `src/cli/commands/backup.ts`
- **추가 옵션**:
  - `--retention <count>`: 보관할 백업 개수 (0이면 무제한)
  - `--cleanup`: 백업 후 자동으로 오래된 백업 정리
- **retention 우선순위**: CLI 옵션 > 설정 파일 > 기본값(10)

### Task 4: cron 스케줄 정보 출력 명령어
- **파일**: `src/cli/commands/backup.ts`
- **명령어**: `n8n-wfm backup cron-example`
- **출력 내용**:
  - 일반적인 스케줄 패턴 (매일, 매주, 매시간)
  - cron 형식 설명 (분, 시, 일, 월, 요일)
  - 로그 로테이션 설정 예시

### Task 5: 백업 모듈 인덱스 업데이트
- **파일**: `src/backup/index.ts`
- **추가 내보내기**:
  - 타입: `ScheduleConfig`, `RetentionConfig`, `BackupOptionsWithRetention`, `BackupStats`, `CleanupResult`
  - 함수: `cleanupOldBackups`, `getBackupStats`, `previewCleanup`, `formatBytes`

### Task 6: 빌드 및 CLI 검증
- `npm run build`: 성공
- `node dist/index.js backup --help`: --retention, --cleanup 옵션 표시 확인
- `node dist/index.js backup cron-example`: cron 설정 가이드 정상 출력

## Files Modified/Created
| File | Action | Description |
|------|--------|-------------|
| `src/backup/retention.ts` | Created | 백업 보관 정책 로직 |
| `src/backup/types.ts` | Modified | 스케줄/보관 관련 타입 추가 |
| `src/backup/index.ts` | Modified | retention 함수 내보내기 |
| `src/cli/commands/backup.ts` | Modified | retention/cleanup 옵션, cron-example 명령어 |

## CLI Usage

### 백업 + 자동 정리
```bash
# 설정 파일의 retention 값 사용
n8n-wfm backup --cleanup

# CLI에서 retention 지정 (최근 5개만 유지)
n8n-wfm backup --retention 5 --cleanup

# 무제한 보관 (정리 안 함)
n8n-wfm backup --retention 0 --cleanup
```

### cron 설정 가이드
```bash
n8n-wfm backup cron-example
```

### 예시 cron 설정
```cron
# 매일 새벽 2시 백업 (권장)
0 2 * * * cd /path/to/project && n8n-wfm backup --cleanup >> /var/log/n8n-backup.log 2>&1

# 매시간 백업 (최근 24개 유지)
0 * * * * cd /path/to/project && n8n-wfm backup --retention 24 --cleanup >> /var/log/n8n-backup.log 2>&1
```

## Verification Results
- [x] `npm run build` 성공
- [x] `node dist/index.js backup --help`에 --retention, --cleanup 옵션 표시
- [x] `node dist/index.js backup cron-example` 실행 시 cron 설정 예시 출력
- [x] cleanupOldBackups 함수 구현 완료

## Notes
- 내장 스케줄러 대신 시스템 cron 활용으로 간단하고 안정적
- retention은 백업 개수 기준 (날짜 기준은 향후 확장 가능)
- cron-example은 사용자가 쉽게 설정할 수 있도록 상세 가이드 제공
