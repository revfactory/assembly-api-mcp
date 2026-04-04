# 국회 API MCP 서버 (assembly-api-mcp) Plans.md

작성일: 2026-04-04 | 최종 업데이트: 2026-04-04

---

## 완료된 Phase (59/63 태스크)

| Phase | 내용 | 태스크 | 상태 |
|-------|------|--------|------|
| 1 | 프로젝트 기반 (스캐폴딩, API 클라이언트, 인증, 에러, 테스트) | 5/5 | cc:完了 |
| 2 | 핵심 도구 (의원, 의안, 일정, 회의록) + 통합 테스트 | 5/5 | cc:完了 |
| 3 | 확장 도구 (위원회, 표결, 청원, 입법예고, 의원활동) | 5/5 | cc:完了 |
| 4 | 부속기관 (도서관, 예산정책처, 입법조사처) + 통합 테스트 | 4/4 | cc:完了 |
| 5 | 고급 기능 (Resource, Prompt, 캐싱, HTTP, Claude Desktop, npm) | 6/6 | cc:完了 |
| 6 | API 검증 및 CLI (276개 조사, 31개 검증, CLI 11커맨드, HTML 테스터) | 5/5 | cc:完了 |
| 7 | 코드 품질 (Promise.all, CLI 지연초기화, LRU 캐시, 캐시키 최적화) | 5/5 | cc:完了 |
| 8 | 미매핑 API 도구화 (계류/처리/최근/심사/표결/통합/이력 7개) | 7/7 | cc:完了 |
| 10 | 배포 (Docker, CI/CD, 모니터링, Rate Limit) | 4/5 | 10.5 미완 |
| 11 | 통합 인터페이스 (discover_apis, query_assembly, 동적 카탈로그) | 6/6 | cc:完了 |
| 13 | 리네이밍 (cong→assembly-api, 저장소 hollobit/assembly-api-mcp 이전) | 1/1 | cc:完了 |

---

## 미완료 태스크 (4건)

### Phase 9: data.go.kr 및 부속기관 연동 (Optional)

| Task | 내용 | DoD | Depends | Status |
|------|------|-----|---------|--------|
| 9.1 | data.go.kr 국회 API 연동 | REST API 4종이 open.assembly.go.kr과 완전 중복 확인 — 스킵 | 1.2 | cc:중복확인 |
| 9.2 | 국회도서관 법률통계 API | argos.nanet.go.kr 연동 | Phase 1 | cc:TODO |
| 9.3 | 국회예산정책처 통계 시스템 | nabostats.go.kr 연동 | Phase 1 | cc:TODO |

### Phase 10: 배포 (잔여)

| Task | 내용 | DoD | Depends | Status |
|------|------|-----|---------|--------|
| 10.5 | Smithery MCP 마켓플레이스 등록 | smithery.ai에 MCP 서버 등록 | 5.6 | cc:TODO |

### Phase 12: 프로필 기반 통합 MCP 인터페이스 (7개 도구)

AI 에이전트 vs 사용자 관점 토론 결과 반영: 7개 Lite 도구로 최종 결정.
- Lite 프로필(기본): 핵심 3개 + 체인 2개 + 범용 2개 = **7개 도구** (~3,800 토큰)
- Full 프로필: 기존 23개 전부 유지 (파워유저/자체호스팅)
- 근거: 토큰 73% 절감, Cursor 슬롯 17.5%, 사용자 TOP 질문 1회 호출 해결

Lite 도구 구성:
1. `search_members` — 의원 검색+상세 (get_members+get_member_detail 병합)
2. `search_bills` — 의안 검색+상세+상태필터 (search_bills+get_bill_detail+pending/processed/recent 흡수)
3. `search_records` — 일정+회의록+표결 통합 (type 파라미터: schedule/meetings/votes)
4. `analyze_legislator` — 의원 종합분석 체인 (인적사항+발의+표결 Promise.all)
5. `track_legislation` — 주제별 법안 추적 체인 (다중 키워드+타임라인)
6. `discover_apis` — 276개 API 탐색 (기존 유지)
7. `query_assembly` — 범용 API 호출 (기존 유지)

| Task | 내용 | DoD | Depends | Status |
|------|------|-----|---------|--------|
| 12.1 | Lite 도구: `search_members` | get_members+get_member_detail 병합, name 단일결과시 상세 반환, 테스트 통과 | - | cc:完了 |
| 12.2 | Lite 도구: `search_bills` | 의안 검색+상세+상태필터(계류/처리/최근 흡수), bill_id로 직접 상세 조회 가능, 테스트 통과 | - | cc:完了 |
| 12.3 | Lite 도구: `search_records` | type=schedule/meetings/votes 분기, 각 도메인별 포맷팅, 테스트 통과 | - | cc:完了 |
| 12.4 | 체인 도구: `analyze_legislator` + `track_legislation` | 의원 종합분석(Promise.all 3개 API) + 주제별 법안 추적(다중 키워드), 테스트 통과 | - | cc:完了 |
| 12.5 | `MCP_PROFILE` 분기 + `registerLiteTools` | config.ts에 profile 추가, server.ts에서 lite→7개/full→23개 분기, .env.example 반영 | 12.1-12.4 | cc:完了 |
| 12.6 | 테스트 + Resource + 문서 | Lite 7개 도구 테스트(9개), Full 기존 테스트 유지(60개), assembly://tools-guide Resource | 12.5 | cc:完了 |

---

## 현재 프로젝트 수치

| 항목 | 수치 |
|------|------|
| MCP 도구 | 7개 (Lite) / 23개 (Full) |
| 검증된 API 코드 | 31개 |
| 전체 국회 API | 276개 (100% 접근 가능) |
| 단위 테스트 | 248개 통과 (88.8% 커버리지) |
| 소스 코드 | ~4,500줄 (TypeScript, 32개 파일) |
| 테스트 코드 | 11개 파일 |
| CLI 커맨드 | 11개 |
| MCP Resource | 5개 |
| MCP Prompt | 3개 |
