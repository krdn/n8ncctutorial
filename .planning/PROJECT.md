# n8n Workflow Manager

## What This Is

n8n 워크플로우를 자동으로 관리하는 시스템. Docker 기반 n8n 환경에서 워크플로우의 백업, 버전 관리, 배포 자동화, 모니터링을 통합 제공한다.

## Core Value

**배포 자동화**: 개발 환경에서 스테이징, 프로덕션으로 워크플로우를 안전하고 자동으로 배포할 수 있어야 한다. 다른 기능이 없어도 이것만은 반드시 동작해야 한다.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] 워크플로우 자동 백업 및 복원 기능
- [ ] 워크플로우 버전 관리 (변경 이력 추적, Git 연동)
- [ ] 환경간 배포 자동화 (개발 → 스테이징 → 프로덕션)
- [ ] 워크플로우 실행 상태 모니터링 및 오류 알림

### Out of Scope

- 웹 UI 대시보드 — v1은 CLI/API 기반으로 시작, UI는 이후 검토
- 다중 테넌트 지원 — 단일 조직용으로 시작

## Context

- Docker Compose로 n8n 운영 중
- n8n MCP 서버가 이미 설정되어 있어 워크플로우 관리 API 활용 가능
- 기존 인프라(GitHub, 알림 시스템 등)와 연동 예정

## Constraints

- **API**: n8n REST API를 통한 워크플로우 관리
- **MCP**: 설정된 n8n MCP 서버 활용
- **Infra**: 기존 Docker 기반 인프라와 호환

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| 배포 자동화를 핵심 가치로 설정 | 환경간 워크플로우 이동이 가장 빈번하고 오류가 발생하기 쉬운 작업 | — Pending |
| Docker 기반 환경 유지 | 이미 Docker Compose로 운영 중, 일관성 유지 | — Pending |
| CLI/API 우선 접근 | 자동화에 적합, UI는 나중에 추가 가능 | — Pending |

---
*Last updated: 2026-01-13 after initialization*
