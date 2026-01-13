---
phase: 02-api-integration
plan: 01
status: complete
duration: ~5분
---

# 02-01 Summary: n8n API 타입 정의 및 클라이언트 기반

## What was done

1. **n8n API 응답 타입 정의** (`src/types/n8n.ts`)
   - N8nWorkflow, N8nWorkflowDetail: 워크플로우 기본/상세 정보
   - N8nNode: 노드 정보
   - N8nTag: 태그 정보
   - N8nExecution: 실행 정보 및 상태/모드 타입
   - N8nCredential: 인증 정보 (민감 정보 제외)
   - 목록 응답 타입: N8nWorkflowListResponse, N8nExecutionListResponse

2. **HTTP 클라이언트 클래스** (`src/api/client.ts`)
   - N8nApiClient 클래스 (native fetch 사용)
   - 자동 헤더 추가: X-N8N-API-KEY, Content-Type
   - 타임아웃 처리 (AbortController)
   - N8nApiError 커스텀 에러 클래스
   - 주요 메서드:
     - healthCheck(): 연결 상태 확인
     - getWorkflows(), getAllWorkflows(): 워크플로우 목록
     - getWorkflow(id): 워크플로우 상세
     - createWorkflow(), updateWorkflow(), deleteWorkflow(): CRUD
     - activateWorkflow(), deactivateWorkflow(): 활성화 관리
     - getExecutions(), getExecution(): 실행 조회
     - getCredentials(): 인증 정보 조회

3. **API 모듈 진입점** (`src/api/index.ts`)
   - N8nApiClient, N8nApiError export
   - 모든 n8n 타입 re-export
   - createClient(envConfig) 헬퍼 함수

## Technical decisions

- **native fetch 사용**: Node.js 20+ 내장 fetch로 외부 의존성 제거
- **타임아웃 처리**: AbortController로 요청별 타임아웃 (기본 30초, healthCheck 5초)
- **에러 처리**: statusCode와 response를 포함하는 N8nApiError로 디버깅 용이

## Files changed

- `src/types/n8n.ts` (새 파일)
- `src/api/client.ts` (새 파일)
- `src/api/index.ts` (새 파일)

## Next step

02-02 계획으로 진행: 연결 관리 및 연결 테스트 기능 구현
