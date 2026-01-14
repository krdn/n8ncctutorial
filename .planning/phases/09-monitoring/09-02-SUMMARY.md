# 09-02 모니터링 CLI 명령어 - 완료 요약

## 개요

워크플로우 실행 상태를 CLI에서 모니터링할 수 있는 명령어를 구현했습니다.

## 완료된 작업

### Task 1-2: monitor 명령어 및 workflow 서브커맨드 (abce841)

**파일:** `src/cli/commands/monitor.ts`

**구현 내용:**

1. **monitor 기본 명령어**
   - 대시보드 형식의 실행 상태 요약 출력
   - 옵션:
     - `-c, --config <path>`: 설정 파일 경로
     - `-e, --env <name>`: 환경 지정
     - `-l, --limit <n>`: 표시할 최근 실행 개수 (기본 20)
     - `-s, --status <status>`: 상태 필터 (success, error, running)
   - 출력:
     - 헤더 (환경 정보)
     - 요약 통계 (Total, Success, Error, Running, Success Rate)
     - 최근 실행 목록 테이블

2. **monitor workflow 서브커맨드**
   - 특정 워크플로우의 실행 통계 출력
   - 옵션:
     - `-c, --config <path>`: 설정 파일 경로
     - `-e, --env <name>`: 환경 지정
     - `-l, --limit <n>`: 분석할 실행 개수 (기본 100)
   - 출력:
     - 워크플로우 정보
     - 통계 (Total Executions, Success Rate, Average Duration)
     - 마지막 실행 정보
     - 상태 분포 프로그레스 바

3. **헬퍼 함수**
   - `formatDuration()`: 실행 시간 포맷팅 (ms, s, m, h 단위)
   - `formatStatus()`: 상태별 색상 적용 (ANSI 코드)
   - `formatDate()`: 날짜 포맷팅 (YYYY-MM-DD HH:mm)
   - `printProgressBar()`: ASCII 프로그레스 바 생성
   - `colorize()`: ANSI 색상 적용 헬퍼

### Task 3: CLI 통합 (765fcec)

**파일:** `src/cli/commands/index.ts`

- `registerMonitorCommand` import 추가
- `registerCommands()` 함수에 monitor 명령어 등록

## 검증 결과

- [x] `npm run build` 성공
- [x] `n8n-wfm monitor --help` 정상 출력
- [x] `n8n-wfm monitor workflow --help` 정상 출력

## 기술적 결정

1. **chalk 대신 ANSI 코드 직접 사용**
   - 프로젝트에 chalk 의존성이 없어 ANSI 이스케이프 코드를 직접 사용
   - `colors` 객체로 색상 코드 관리
   - `colorize()` 헬퍼 함수로 일관된 색상 적용

2. **workflowName 대신 workflowId 표시**
   - N8nExecution 타입에 workflowName 속성이 없음
   - 실행 목록에서 workflowId를 표시하도록 구현

## 파일 구조

```
src/cli/commands/
├── monitor.ts    # 신규 생성 (모니터링 CLI 명령어)
└── index.ts      # 수정 (monitor 명령어 등록)
```

## 커밋 이력

| 커밋 | Task | 설명 |
|------|------|------|
| abce841 | Task 1-2 | monitor CLI 명령어 구현 |
| 765fcec | Task 3 | monitor 명령어 CLI 통합 |
