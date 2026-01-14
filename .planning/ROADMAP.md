# Roadmap: n8n Workflow Manager

## Overview

n8n 워크플로우 자동 관리 시스템 구축. 기반 구조 설정부터 시작하여 n8n API 연동, 백업/복원 시스템, Git 기반 버전 관리, 다중 환경 배포 자동화, 그리고 모니터링/알림까지 순차적으로 구현한다. 핵심 가치인 **배포 자동화**를 중심으로 모든 기능이 유기적으로 연결된다.

## Domain Expertise

None

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [x] **Phase 1: Foundation** - 프로젝트 기반 구조 설정 ✅
- [x] **Phase 2: n8n API Integration** - n8n API 연동 기반 구축 ✅
- [x] **Phase 3: Workflow Export/Import** - 워크플로우 내보내기/가져오기 ✅
- [x] **Phase 4: Backup System** - 자동 백업 시스템 ✅
- [x] **Phase 5: Restore System** - 백업 복원 기능 ✅
- [x] **Phase 6: Version Control** - Git 기반 버전 관리 ✅
- [x] **Phase 7: Environment Config** - 다중 환경 설정 관리 ✅
- [x] **Phase 8: Deployment Core** - 핵심 배포 자동화 ✅
- [ ] **Phase 9: Monitoring** - 워크플로우 모니터링
- [ ] **Phase 10: Alerting** - 오류 알림 시스템

## Phase Details

### Phase 1: Foundation
**Goal**: 프로젝트 기본 구조 설정 (TypeScript, 설정 파일, CLI 스캐폴딩)
**Depends on**: Nothing (first phase)
**Research**: Unlikely (표준 프로젝트 셋업 패턴)
**Plans**: TBD

Plans:
- [x] 01-01: TypeScript 프로젝트 초기화 ✅
- [x] 01-02: CLI 기본 구조 설정 ✅
- [x] 01-03: 설정 파일 구조 정의 ✅

### Phase 2: n8n API Integration
**Goal**: n8n REST API 및 MCP 서버 연동 기반 구축
**Depends on**: Phase 1
**Research**: Likely (n8n API 문서, MCP 서버 활용법)
**Research topics**: n8n REST API 엔드포인트, 인증 방식, MCP 도구 활용법
**Plans**: TBD

Plans:
- [x] 02-01: n8n API 타입 정의 및 클라이언트 기반 ✅
- [x] 02-02: 인증 및 연결 관리 ✅
- [x] 02-03: CLI status/config 명령어 구현 ✅

### Phase 3: Workflow Export/Import
**Goal**: 워크플로우를 JSON으로 내보내고 가져오는 기능
**Depends on**: Phase 2
**Research**: Likely (n8n 워크플로우 JSON 구조)
**Research topics**: 워크플로우 JSON 스키마, credentials 처리 방식
**Plans**: 3 plans created

Plans:
- [x] 03-01: 워크플로우 내보내기 (export 모듈 + CLI) ✅
- [x] 03-02: 워크플로우 가져오기 (import 모듈 + CLI) ✅
- [x] 03-03: 벌크 내보내기/가져오기 (export-all, import-all CLI) ✅

### Phase 4: Backup System
**Goal**: 워크플로우를 자동으로 백업하는 시스템
**Depends on**: Phase 3
**Research**: Unlikely (내부 패턴 활용, export 기능 재사용)
**Plans**: 3 plans created

Plans:
- [x] 04-01: 백업 저장소 구조 설계 ✅
- [x] 04-02: 수동 백업 명령어 ✅
- [x] 04-03: 스케줄 백업 (cron 연동) ✅

### Phase 5: Restore System
**Goal**: 백업에서 워크플로우를 복원하는 기능
**Depends on**: Phase 4
**Research**: Unlikely (import 기능 재사용)
**Plans**: 3 plans created

Plans:
- [x] 05-01: 백업 목록 조회 ✅
- [x] 05-02: 특정 백업 복원 ✅
- [x] 05-03: 선택적 워크플로우 복원 ✅

### Phase 6: Version Control
**Goal**: Git 기반 워크플로우 변경 이력 관리
**Depends on**: Phase 4
**Research**: Likely (Git 통합 전략, diff 알고리즘)
**Research topics**: 워크플로우 diff 표시 방법, Git 자동 커밋 전략, 브랜치 관리
**Plans**: TBD

Plans:
- [x] 06-01: Git 저장소 초기화 및 연동 ✅
- [x] 06-02: 워크플로우 변경 감지 ✅
- [x] 06-03: 자동 커밋 및 변경 이력 ✅
- [x] 06-04: 워크플로우 diff 보기 ✅

### Phase 7: Environment Config
**Goal**: 개발/스테이징/프로덕션 환경 설정 관리
**Depends on**: Phase 2
**Research**: Unlikely (설정 관리 표준 패턴)
**Plans**: 3 plans created

Plans:
- [x] 07-01: 환경별 설정 파일 구조 ✅
- [x] 07-02: 환경 전환 명령어 ✅
- [x] 07-03: credentials 환경별 매핑 ✅

### Phase 8: Deployment Core
**Goal**: 환경간 워크플로우 배포 자동화 (핵심 가치)
**Depends on**: Phase 3, Phase 7
**Research**: Likely (환경간 credential 처리, 배포 전략)
**Research topics**: credential 변환/매핑 방법, 롤백 전략, 배포 검증
**Plans**: TBD

Plans:
- [x] 08-01: 배포 타입 정의 및 파이프라인 설계 ✅
- [x] 08-02: Credential 변환 유틸리티 ✅
- [x] 08-03: 배포 검증 유틸리티 ✅
- [x] 08-04: 롤백 기능 구현 ✅
- [x] 08-05: 배포 CLI 명령어 ✅

### Phase 9: Monitoring
**Goal**: 워크플로우 실행 상태 모니터링
**Depends on**: Phase 2
**Research**: Likely (n8n 실행 API, 상태 폴링 전략)
**Research topics**: n8n executions API, 실행 상태 조회, 실시간 모니터링 방법
**Plans**: 3 plans created

Plans:
- [ ] 09-01: 모니터링 모듈 (타입, 실행 조회 함수)
- [ ] 09-02: 모니터링 CLI 명령어 (monitor, monitor workflow)
- [ ] 09-03: 실행 이력 조회 (monitor history, monitor execution)

### Phase 10: Alerting
**Goal**: 워크플로우 오류 발생 시 알림 전송
**Depends on**: Phase 9
**Research**: Likely (알림 시스템 연동)
**Research topics**: Slack/Email/Webhook 알림 연동, 알림 규칙 설정
**Plans**: TBD

Plans:
- [ ] 10-01: 알림 채널 설정 (Slack, Email)
- [ ] 10-02: 오류 감지 및 알림 트리거
- [ ] 10-03: 알림 규칙 관리

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 3/3 | ✅ Completed | 2026-01-13 |
| 2. n8n API Integration | 3/3 | ✅ Completed | 2026-01-13 |
| 3. Workflow Export/Import | 3/3 | ✅ Completed | 2026-01-14 |
| 4. Backup System | 3/3 | ✅ Completed | 2026-01-14 |
| 5. Restore System | 3/3 | ✅ Completed | 2026-01-14 |
| 6. Version Control | 4/4 | ✅ Completed | 2026-01-14 |
| 7. Environment Config | 3/3 | ✅ Completed | 2026-01-14 |
| 8. Deployment Core | 5/5 | ✅ Completed | 2026-01-14 |
| 9. Monitoring | 0/3 | Not started | - |
| 10. Alerting | 0/3 | Not started | - |
