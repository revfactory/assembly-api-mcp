# assembly-api-mcp

대한민국 국회 Open API를 [Model Context Protocol (MCP)](https://modelcontextprotocol.io) 서버로 제공합니다.

Claude, ChatGPT 등 AI 도구에서 국회의원, 의안, 일정, 회의록, 위원회, 표결, 청원 등 국회 데이터에 실시간으로 접근할 수 있습니다.

## 주요 기능

- **7개 Lite / 23개 Full 프로필 도구** — 기본 Lite 프로필로 핵심 기능 제공
- **276개 국회 API 100% 접근** — `discover_apis` + `query_assembly` 범용 도구
- **31개 검증된 API 코드** — 실제 데이터 반환 확인
- **CLI 지원** — 터미널에서 직접 국회 데이터 조회
- **이중 Transport** — stdio (Claude Desktop) + HTTP (원격 서버)
- **인메모리 캐싱** — TTL 기반, 정적/동적 데이터 구분
- **API 모니터링** — 응답 시간 추적, Rate Limit 관리

## 빠른 시작

> 상세한 가이드는 [QUICK_START.md](QUICK_START.md)를 참조하세요.

```bash
# 1. 설치
git clone https://github.com/hollobit/assembly-api-mcp.git
cd assembly-api-mcp
npm install && npm run build

# 2. API 키 설정
cp .env.example .env
# .env 파일에 ASSEMBLY_API_KEY 입력 (발급: https://open.assembly.go.kr)

# 3. 테스트
npx tsx src/cli.ts test
```

## Claude Desktop 연동

`~/Library/Application Support/Claude/claude_desktop_config.json` (macOS):

```json
{
  "mcpServers": {
    "assembly-api": {
      "command": "node",
      "args": ["/absolute/path/to/assembly-api/dist/index.js"],
      "env": {
        "ASSEMBLY_API_KEY": "your-api-key-here",
        "MCP_PROFILE": "lite"
      }
    }
  }
}
```

> Claude Desktop을 완전히 종료(트레이 포함)한 후 재시작해야 설정이 적용됩니다.

## MCP 도구 목록

### Lite 프로필 (7개, 기본)

AI가 효율적으로 사용할 수 있도록 핵심 기능을 통합한 프로필입니다.

| 도구 | 설명 |
|------|------|
| `search_members` | 의원 검색+상세 (이름/정당/선거구, 사진 URL 포함, 1건이면 자동 상세) |
| `search_bills` | 의안 검색+상세+상태필터 (계류/처리/최근, bill_id로 상세) |
| `search_records` | 일정+회의록+표결 (type: schedule/meetings/votes) |
| `analyze_legislator` | 의원 종합분석 (인적+사진+발의+표결 한 번에) |
| `track_legislation` | 주제별 법안 추적 (다중 키워드, 심사이력) |
| `discover_apis` | 276개 API 키워드 검색 |
| `query_assembly` | 범용 API 직접 호출 |

### Full 프로필 (23개)

`MCP_PROFILE=full`로 전환하면 기존 23개 개별 도구를 사용할 수 있습니다.

#### 국회의원 (3개)

| 도구 | 설명 |
|------|------|
| `get_members` | 국회의원 검색 (이름/정당/선거구, 사진 URL 포함) |
| `get_member_detail` | 의원 상세 정보 |
| `search_member_activity` | 의원 의정활동 (발의법안 + 표결) |

#### 의안 (9개)

| 도구 | 설명 |
|------|------|
| `search_bills` | 의안 검색 (의안명/제안자/위원회) |
| `get_bill_detail` | 의안 상세 조회 |
| `search_all_bills` | 의안 통합검색 (전 대수 포함) |
| `get_pending_bills` | 계류의안 목록 |
| `get_processed_bills` | 처리의안 목록 |
| `get_recent_bills` | 최근 본회의 처리 의안 |
| `get_bill_review` | 의안 심사정보 |
| `get_bill_history` | 의안 접수/처리 이력 |
| `get_plenary_votes` | 본회의 표결정보 |

#### 일정 / 회의록 (2개)

| 도구 | 설명 |
|------|------|
| `get_schedule` | 국회 일정 (통합, 90,201건) |
| `search_meeting_records` | 회의록 검색 (본회의/위원회/국감/인사청문회) |

#### 위원회 / 표결 / 청원 / 입법예고 (4개)

| 도구 | 설명 |
|------|------|
| `get_committees` | 위원회 목록 (356건) |
| `get_vote_results` | 의안별 표결 결과 |
| `search_petitions` | 청원 검색 (276건) |
| `get_legislation_notices` | 입법예고 조회 (265건) |

#### 부속기관 (3개)

| 도구 | 설명 |
|------|------|
| `search_library` | 국회도서관 자료 검색 |
| `get_budget_analysis` | 예산정책처 분석 자료 |
| `search_research_reports` | 입법조사처 보고서 |

#### 범용 (2개) — 276개 API 100% 커버

| 도구 | 설명 |
|------|------|
| `discover_apis` | 276개 국회 API 키워드 검색 |
| `query_assembly` | 임의 API 코드로 직접 호출 |

## CLI 사용법

```bash
# 의원 검색
npx tsx src/cli.ts members --party 더불어민주당

# 의원 의정활동
npx tsx src/cli.ts activity --name 이해민

# 의안 검색
npx tsx src/cli.ts bills --name AI

# 의안 상세
npx tsx src/cli.ts bill-detail <BILL_ID>

# 표결 / 계류 / 처리 / 최근
npx tsx src/cli.ts votes
npx tsx src/cli.ts pending
npx tsx src/cli.ts processed
npx tsx src/cli.ts recent

# 전체 API 목록
npx tsx src/cli.ts meta

# API 작동 테스트
npx tsx src/cli.ts test
```

## 환경 변수

| 변수 | 필수 | 기본값 | 설명 |
|------|------|--------|------|
| `ASSEMBLY_API_KEY` | O | - | 열린국회정보 API 키 |
| `DATA_GO_KR_SERVICE_KEY` | X | - | 공공데이터포털 ServiceKey |
| `NANET_API_KEY` | X | - | 국회도서관 API 키 |
| `NABO_API_KEY` | X | - | 국회예산정책처 API 키 |
| `MCP_PROFILE` | X | `lite` | `lite` 또는 `full` |
| `MCP_TRANSPORT` | X | `stdio` | `stdio` 또는 `http` |
| `MCP_PORT` | X | `3000` | HTTP 모드 포트 |
| `LOG_LEVEL` | X | `info` | 로그 레벨 |
| `CACHE_ENABLED` | X | `true` | 캐시 활성화 |

## API 키 발급

1. [열린국회정보](https://open.assembly.go.kr) 접속
2. 회원가입 (무료)
3. 로그인 후 마이페이지 > OPEN API > 인증키 발급
4. 발급받은 키를 `.env` 파일의 `ASSEMBLY_API_KEY`에 입력

> `sample` 키로 최대 10건까지 테스트할 수 있습니다.

## 프로젝트 구조

```
assembly-api/
├── src/
│   ├── index.ts              # MCP 서버 진입점
│   ├── server.ts             # McpServer 초기화 (stdio/HTTP)
│   ├── config.ts             # 환경 변수 설정
│   ├── cli.ts                # CLI 인터페이스
│   ├── api/
│   │   ├── client.ts         # HTTP 클라이언트 (캐싱/모니터링 통합)
│   │   ├── cache.ts          # 인메모리 TTL 캐시 (LRU)
│   │   ├── codes.ts          # 검증된 API 코드 매핑
│   │   ├── monitor.ts        # API 응답 시간 모니터링
│   │   └── rate-limiter.ts   # Rate Limit 추적
│   ├── tools/                # MCP 도구 (16개 파일, 23개 도구)
│   │   ├── lite/             # Lite 프로필 통합 도구 (7개)
│   ├── resources/            # MCP 정적 리소스
│   └── prompts/              # MCP 프롬프트 템플릿
├── tests/                    # 단위 테스트 (248개)
├── examples/
│   └── api-tester.html       # 브라우저 API 테스터
├── docs/
│   ├── api-catalog.md        # 국회 API 276개 전체 목록
│   ├── mcp-api.md            # MCP 도구 ↔ API 매핑
│   └── discovered-codes.md   # 발굴된 API 코드
├── .env.example              # 환경 변수 템플릿
├── Dockerfile                # Docker 이미지
├── docker-compose.yml        # Docker Compose
└── QUICK_START.md            # 빠른 시작 가이드
```

## 개발

```bash
npm run build      # TypeScript 빌드
npm test           # 테스트 실행
npm run dev        # 개발 모드 (tsx)
npm run cli        # CLI 실행
npm run lint       # 타입 체크 (tsc --noEmit)
```

## Docker

```bash
docker compose up -d
# HTTP 모드로 포트 3000에서 실행
# Health check: curl localhost:3000/health
```

## 참고 프로젝트

- [korean-law-mcp](https://github.com/SeoNaRu/korean-law-mcp) — 한국 법률 MCP 서버
- [data-go-mcp-servers](https://github.com/Koomook/data-go-mcp-servers) — 공공데이터 MCP 서버

## 라이선스

MIT License - [LICENSE](LICENSE) 참조
