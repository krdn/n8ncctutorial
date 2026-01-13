# 06-01 Summary: Git 저장소 초기화 및 연동

## 완료된 작업

### Task 1: simple-git 설치 및 버전 관리 타입 정의
- simple-git 패키지 (v3.30.0) 설치 완료
- `src/version/types.ts` 생성 - Git 관련 타입 정의:
  - `GitConfig`: Git 저장소 기본 설정
  - `GitStatus`: 저장소 상태 정보 (브랜치, 변경 파일 등)
  - `CommitOptions`: 커밋 옵션 (메시지, 작성자)
  - `CommitResult`: 커밋 결과 정보
  - `CommitLogEntry`: 커밋 로그 항목
  - `VersionControlConfig`: 설정 파일용 Git 설정

### Task 2: Git 연동 모듈 구현
- `src/version/git.ts` 생성 - simple-git 래핑 함수들:
  - `initRepo(repoPath)`: Git 저장소 초기화 (.gitignore 자동 생성)
  - `isGitRepo(repoPath)`: Git 저장소 여부 확인
  - `getRepoStatus(repoPath)`: 현재 상태 조회
  - `stageFiles(repoPath, files)`: 파일 스테이징
  - `commitChanges(repoPath, options)`: 변경 사항 커밋
  - `getCommitLog(repoPath, limit?)`: 최근 커밋 이력 조회
- `GitError` 커스텀 에러 클래스 구현
- 한글 파일명 지원 (`core.quotepath false` 설정)
- 기본 .gitignore 템플릿 포함 (credentials, .env, 로그 파일 등 제외)

### Task 3: version 모듈 인덱스 및 CLI 명령어 구현
- `src/version/index.ts` 생성 - 타입 및 함수 재내보내기
- `src/cli/commands/version.ts` 생성 - CLI 명령어:
  - `n8n-wfm version init [path]` - Git 저장소 초기화
    - 기본 경로: 설정 파일의 backup.baseDir 또는 `./backups`
    - `--force`: 기존 저장소 재초기화
  - `n8n-wfm version status` - 저장소 상태 확인
  - `n8n-wfm version log [--limit N]` - 커밋 이력 조회 (기본 10개)
- `src/cli/commands/index.ts` 수정 - registerVersionCommand 등록

## 생성/수정된 파일

### 새로 생성된 파일
- `src/version/types.ts` - 버전 관리 타입 정의
- `src/version/git.ts` - Git 연동 모듈
- `src/version/index.ts` - 모듈 인덱스
- `src/cli/commands/version.ts` - CLI 명령어

### 수정된 파일
- `package.json` - simple-git 의존성 추가
- `src/cli/commands/index.ts` - version 명령어 등록

## 검증 결과

### 빌드 결과
```
$ npm run build
> n8n-workflow-manager@0.1.0 build
> tsc
(성공)
```

### CLI 도움말 출력
```
$ node dist/index.js version --help
Usage: n8n-wfm version [options] [command]

워크플로우 버전 관리 (Git)

Commands:
  init [options] [path]  Git 저장소 초기화
  status [options]       저장소 상태 확인
  log [options]          커밋 이력 조회
```

### 기능 테스트
- `version init`: Git 저장소 초기화 및 .gitignore 생성 정상
- `version status`: 브랜치, 파일 상태 표시 정상
- `version log`: 커밋 이력 조회 정상 (커밋 없을 때 안내 메시지)

### 패키지 설치 확인
```
$ npm ls simple-git
n8n-workflow-manager@0.1.0
└── simple-git@3.30.0
```

## 다음 단계 참고

### 06-02에서 사용할 API
- `stageFiles(repoPath, files)` - 백업 후 파일 스테이징
- `commitChanges(repoPath, options)` - 자동 커밋 생성
- `getRepoStatus(repoPath)` - 커밋 전 상태 확인
- `getCommitLog(repoPath, limit)` - 이력 조회

### 주의사항
- `commitChanges`에서 author 옵션 사용 시 raw 명령어로 처리됨
- Git 저장소가 아닌 경우 `getRepoStatus`는 `isRepo: false`를 포함한 기본 객체 반환
- 커밋이 없는 저장소에서 `getCommitLog`는 빈 배열 반환

### 확장 가능성
- `VersionControlConfig` 타입이 설정 파일 확장을 위해 준비됨
- 자동 커밋, 커밋 메시지 템플릿 등 설정 파일에서 활성화 가능
