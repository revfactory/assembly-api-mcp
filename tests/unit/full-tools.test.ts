import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { type AppConfig } from "../../src/config.js";
import { registerBillExtraTools } from "../../src/tools/bill-extras.js";
import { registerBudgetTools } from "../../src/tools/budget.js";
import { registerCommitteeTools } from "../../src/tools/committees.js";
import { registerLegislationTools } from "../../src/tools/legislation.js";
import { registerLibraryTools } from "../../src/tools/library.js";
import { registerPetitionTools } from "../../src/tools/petitions.js";
import { registerResearchTools } from "../../src/tools/research.js";
import { registerSpeechTools } from "../../src/tools/speeches.js";
import { registerVoteTools } from "../../src/tools/votes.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTestConfig(): AppConfig {
  return {
    apiKeys: {
      assemblyApiKey: "test-key",
      dataGoKrServiceKey: undefined,
      nanetApiKey: undefined,
      naboApiKey: undefined,
    },
    server: { transport: "stdio", port: 3000, logLevel: "info" },
    cache: { enabled: false, ttlStatic: 86400, ttlDynamic: 3600 },
    apiResponse: { defaultType: "json", defaultPageSize: 20, maxPageSize: 100 },
    profile: "full",
  };
}

function createServer(): McpServer {
  return new McpServer({ name: "test-server", version: "0.0.1" });
}

function getRegisteredTools(
  server: McpServer,
): Record<string, { description: string; handler: (...args: unknown[]) => Promise<unknown>; enabled: boolean }> {
  return (server as any)._registeredTools;
}

function buildAssemblyResponse(
  apiCode: string,
  rows: readonly Record<string, unknown>[],
  totalCount?: number,
): string {
  const count = totalCount ?? rows.length;
  return JSON.stringify({
    [apiCode]: [
      {
        head: [
          { list_total_count: count },
          { RESULT: { CODE: "INFO-000", MESSAGE: "정상 처리되었습니다." } },
        ],
      },
      { row: rows },
    ],
  });
}

function mockFetchSuccess(body: string): void {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(body, { status: 200 }),
  );
}

function mockFetchSequence(...bodies: string[]): void {
  const spy = vi.spyOn(globalThis, "fetch");
  for (const body of bodies) {
    spy.mockResolvedValueOnce(new Response(body, { status: 200 }));
  }
}

function mockFetchNetworkError(): void {
  vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Connection refused"));
}

type ToolResult = { content: Array<{ text: string }>; isError?: boolean };

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Full-mode MCP Tools", () => {
  let server: McpServer;
  const config = createTestConfig();

  beforeEach(() => {
    vi.restoreAllMocks();
    server = createServer();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // bill-extras.ts (7 tools)
  // =========================================================================

  describe("bill-extras", () => {
    // -- Registration --
    it("registerBillExtraTools는 7개 도구를 등록한다", () => {
      registerBillExtraTools(server, config);
      const tools = getRegisteredTools(server);
      const expected = [
        "get_pending_bills",
        "get_processed_bills",
        "get_recent_bills",
        "get_bill_review",
        "get_plenary_votes",
        "search_all_bills",
        "get_bill_history",
      ];
      for (const name of expected) {
        expect(tools).toHaveProperty(name);
      }
    });

    // -- get_pending_bills --
    describe("get_pending_bills", () => {
      it("계류의안 목록을 반환한다", async () => {
        mockFetchSuccess(buildAssemblyResponse("nwbqublzajtcqpdae", [
          { BILL_NO: "2100001", BILL_NAME: "테스트법", PROPOSER: "홍길동", PROPOSER_KIND: "의원" },
        ], 1));

        registerBillExtraTools(server, config);
        const tools = getRegisteredTools(server);
        const result = await tools.get_pending_bills.handler({}, {} as never) as ToolResult;

        const parsed = JSON.parse(result.content[0].text);
        expect(parsed.total).toBe(1);
        expect(parsed.items[0]).toMatchObject({ 의안명: "테스트법" });
      });

      it("bill_name 필터로 검색한다", async () => {
        mockFetchSuccess(buildAssemblyResponse("nwbqublzajtcqpdae", [
          { BILL_NO: "2100002", BILL_NAME: "교육기본법", PROPOSER: "김철수", PROPOSER_KIND: "의원" },
        ], 1));

        registerBillExtraTools(server, config);
        const tools = getRegisteredTools(server);
        const result = await tools.get_pending_bills.handler(
          { bill_name: "교육" },
          {} as never,
        ) as ToolResult;

        const parsed = JSON.parse(result.content[0].text);
        expect(parsed.items[0]).toMatchObject({ 의안명: "교육기본법" });

        const calledUrl = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string;
        expect(calledUrl).toContain("BILL_NAME");
      });

      it("네트워크 오류를 처리한다", async () => {
        mockFetchNetworkError();

        registerBillExtraTools(server, config);
        const tools = getRegisteredTools(server);
        const result = await tools.get_pending_bills.handler({}, {} as never) as ToolResult;

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain("오류");
      });
    });

    // -- get_processed_bills --
    describe("get_processed_bills", () => {
      it("처리의안 목록을 반환한다", async () => {
        mockFetchSuccess(buildAssemblyResponse("nzpltgfqabtcpsmai", [
          { BILL_NO: "2200001", BILL_NAME: "처리법안", PROPOSER: "이영희", PROPOSER_KIND: "의원" },
        ], 1));

        registerBillExtraTools(server, config);
        const tools = getRegisteredTools(server);
        const result = await tools.get_processed_bills.handler(
          { age: 22 },
          {} as never,
        ) as ToolResult;

        const parsed = JSON.parse(result.content[0].text);
        expect(parsed.total).toBe(1);
        expect(parsed.items[0]).toMatchObject({ 의안명: "처리법안" });
      });
    });

    // -- get_recent_bills --
    describe("get_recent_bills", () => {
      it("최근 본회의 처리의안을 반환한다", async () => {
        mockFetchSuccess(buildAssemblyResponse("nxjuyqnxadtotdrbw", [
          { BILL_NO: "2200002", BILL_NAME: "최근법안", PROPOSER: "박민수", PROPOSER_KIND: "정부" },
        ], 1));

        registerBillExtraTools(server, config);
        const tools = getRegisteredTools(server);
        const result = await tools.get_recent_bills.handler({}, {} as never) as ToolResult;

        const parsed = JSON.parse(result.content[0].text);
        expect(parsed.total).toBe(1);
        expect(parsed.items[0]).toMatchObject({ 의안명: "최근법안" });
      });
    });

    // -- get_bill_review --
    describe("get_bill_review", () => {
      it("의안 심사정보를 반환한다", async () => {
        mockFetchSuccess(buildAssemblyResponse("BILLJUDGE", [
          { BILL_NO: "2200003", BILL_NM: "심사법안", PPSR_KIND: "의원", PPSL_DT: "2024-01-01", JRCMIT_NM: "법제사법위원회" },
        ], 1));

        registerBillExtraTools(server, config);
        const tools = getRegisteredTools(server);
        const result = await tools.get_bill_review.handler(
          { bill_name: "심사법안" },
          {} as never,
        ) as ToolResult;

        const parsed = JSON.parse(result.content[0].text);
        expect(parsed.total).toBe(1);
        expect(parsed.items[0]).toMatchObject({ 의안명: "심사법안", 소관위원회: "법제사법위원회" });
      });
    });

    // -- get_plenary_votes --
    describe("get_plenary_votes", () => {
      it("본회의 표결정보를 반환한다", async () => {
        mockFetchSuccess(buildAssemblyResponse("nwbpacrgavhjryiph", [
          { BILL_NO: "2200004", BILL_NM: "표결법안", PROPOSER: "정당대표", COMMITTEE_NM: "교육위원회" },
        ], 1));

        registerBillExtraTools(server, config);
        const tools = getRegisteredTools(server);
        const result = await tools.get_plenary_votes.handler({}, {} as never) as ToolResult;

        const parsed = JSON.parse(result.content[0].text);
        expect(parsed.total).toBe(1);
        expect(parsed.items[0]).toMatchObject({ 의안명: "표결법안", 소관위원회: "교육위원회" });
      });
    });

    // -- search_all_bills --
    describe("search_all_bills", () => {
      it("의안 통합검색 결과를 반환한다", async () => {
        mockFetchSuccess(buildAssemblyResponse("TVBPMBILL11", [
          { BILL_NO: "2200005", BILL_NAME: "통합검색법안", PROPOSER: "김의원", PROPOSER_KIND: "의원" },
        ], 1));

        registerBillExtraTools(server, config);
        const tools = getRegisteredTools(server);
        const result = await tools.search_all_bills.handler(
          { bill_name: "통합검색" },
          {} as never,
        ) as ToolResult;

        const parsed = JSON.parse(result.content[0].text);
        expect(parsed.total).toBe(1);
        expect(parsed.items[0]).toMatchObject({ 의안명: "통합검색법안" });
      });
    });

    // -- get_bill_history --
    describe("get_bill_history", () => {
      it("의안 접수/처리 이력을 반환한다", async () => {
        mockFetchSuccess(buildAssemblyResponse("BILLRCP", [
          { BILL_NO: "2200006", BILL_NM: "이력법안", BILL_KIND: "법률안", PPSR_KIND: "의원", PPSL_DT: "2024-03-01", PROC_RSLT: "가결", LINK_URL: "https://example.com" },
        ], 1));

        registerBillExtraTools(server, config);
        const tools = getRegisteredTools(server);
        const result = await tools.get_bill_history.handler(
          { bill_no: "2200006" },
          {} as never,
        ) as ToolResult;

        const parsed = JSON.parse(result.content[0].text);
        expect(parsed.total).toBe(1);
        expect(parsed.items[0]).toMatchObject({ 의안명: "이력법안", 처리결과: "가결" });
      });

      it("네트워크 오류를 처리한다", async () => {
        mockFetchNetworkError();

        registerBillExtraTools(server, config);
        const tools = getRegisteredTools(server);
        const result = await tools.get_bill_history.handler(
          { bill_no: "2200006" },
          {} as never,
        ) as ToolResult;

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain("오류");
      });
    });
  });

  // =========================================================================
  // budget.ts
  // =========================================================================

  describe("budget", () => {
    it("registerBudgetTools는 get_budget_analysis를 등록한다", () => {
      registerBudgetTools(server, config);
      const tools = getRegisteredTools(server);
      expect(tools).toHaveProperty("get_budget_analysis");
    });

    it("예산정책처 분석 자료를 반환한다", async () => {
      mockFetchSuccess(buildAssemblyResponse("OZN379001174FW17905", [
        { TITLE: "2024 경제전망", CONTENT: "경제 분석 내용", PUB_DATE: "2024-01-15", LINK_URL: "https://example.com", CATEGORY: "경제" },
      ], 1));

      registerBudgetTools(server, config);
      const tools = getRegisteredTools(server);
      const result = await tools.get_budget_analysis.handler(
        { keyword: "경제" },
        {} as never,
      ) as ToolResult;

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.total).toBe(1);
      expect(parsed.items[0]).toMatchObject({ 제목: "2024 경제전망" });
    });

    it("네트워크 오류를 처리한다", async () => {
      mockFetchNetworkError();

      registerBudgetTools(server, config);
      const tools = getRegisteredTools(server);
      const result = await tools.get_budget_analysis.handler({}, {} as never) as ToolResult;

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("오류");
    });
  });

  // =========================================================================
  // committees.ts
  // =========================================================================

  describe("committees", () => {
    it("registerCommitteeTools는 get_committees를 등록한다", () => {
      registerCommitteeTools(server, config);
      const tools = getRegisteredTools(server);
      expect(tools).toHaveProperty("get_committees");
    });

    it("위원회 목록을 반환한다", async () => {
      mockFetchSuccess(buildAssemblyResponse("nxrvzonlafugpqjuh", [
        { CMT_DIV_NM: "상임위원회", COMMITTEE_NAME: "법제사법위원회", HR_DEPT_CD: "9700001", HG_NM: "위원장", HG_NM_LIST: "간사1,간사2", LIMIT_CNT: 18, CURR_CNT: 18 },
      ], 1));

      registerCommitteeTools(server, config);
      const tools = getRegisteredTools(server);
      const result = await tools.get_committees.handler({}, {} as never) as ToolResult;

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.total).toBe(1);
      expect(parsed.items[0]).toMatchObject({ 위원회명: "법제사법위원회", 위원회구분: "상임위원회" });
    });

    it("네트워크 오류를 처리한다", async () => {
      mockFetchNetworkError();

      registerCommitteeTools(server, config);
      const tools = getRegisteredTools(server);
      const result = await tools.get_committees.handler({}, {} as never) as ToolResult;

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("오류");
    });
  });

  // =========================================================================
  // legislation.ts
  // =========================================================================

  describe("legislation", () => {
    it("registerLegislationTools는 get_legislation_notices를 등록한다", () => {
      registerLegislationTools(server, config);
      const tools = getRegisteredTools(server);
      expect(tools).toHaveProperty("get_legislation_notices");
    });

    it("입법예고 목록을 반환한다", async () => {
      mockFetchSuccess(buildAssemblyResponse("nknalejkafmvgzmpt", [
        { BILL_NO: "2200010", BILL_NAME: "교육법개정안", AGE: "22", PROPOSER_KIND_CD: "의원", PROPOSER: "김교육", CURR_COMMITTEE: "교육위원회", NOTI_ED_DT: "2024-06-30", LINK_URL: "https://example.com" },
      ], 1));

      registerLegislationTools(server, config);
      const tools = getRegisteredTools(server);
      const result = await tools.get_legislation_notices.handler(
        { keyword: "교육" },
        {} as never,
      ) as ToolResult;

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.total).toBe(1);
      expect(parsed.items[0]).toMatchObject({ 법안명: "교육법개정안", 소관위원회: "교육위원회" });
    });

    it("네트워크 오류를 처리한다", async () => {
      mockFetchNetworkError();

      registerLegislationTools(server, config);
      const tools = getRegisteredTools(server);
      const result = await tools.get_legislation_notices.handler({}, {} as never) as ToolResult;

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("오류");
    });
  });

  // =========================================================================
  // library.ts
  // =========================================================================

  describe("library", () => {
    it("registerLibraryTools는 search_library를 등록한다", () => {
      registerLibraryTools(server, config);
      const tools = getRegisteredTools(server);
      expect(tools).toHaveProperty("search_library");
    });

    it("국회도서관 자료 검색 결과를 반환한다", async () => {
      mockFetchSuccess(buildAssemblyResponse("nywrpgoaatcpoqbiy", [
        { TITLE: "헌법학개론", AUTHOR: "김헌법", PUBLISHER: "법문사", PUB_YEAR: "2023", LINK_URL: "https://example.com" },
      ], 1));

      registerLibraryTools(server, config);
      const tools = getRegisteredTools(server);
      const result = await tools.search_library.handler(
        { keyword: "헌법" },
        {} as never,
      ) as ToolResult;

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.total).toBe(1);
      expect(parsed.items[0]).toMatchObject({ 제목: "헌법학개론", 저자: "김헌법" });
    });

    it("네트워크 오류를 처리한다", async () => {
      mockFetchNetworkError();

      registerLibraryTools(server, config);
      const tools = getRegisteredTools(server);
      const result = await tools.search_library.handler(
        { keyword: "헌법" },
        {} as never,
      ) as ToolResult;

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("오류");
    });
  });

  // =========================================================================
  // petitions.ts
  // =========================================================================

  describe("petitions", () => {
    it("registerPetitionTools는 search_petitions를 등록한다", () => {
      registerPetitionTools(server, config);
      const tools = getRegisteredTools(server);
      expect(tools).toHaveProperty("search_petitions");
    });

    it("청원 검색 결과를 반환한다", async () => {
      mockFetchSuccess(buildAssemblyResponse("nvqbafvaajdiqhehi", [
        { BILL_NO: "2300001", BILL_NAME: "환경보호청원", PROPOSER: "시민단체", APPROVER: "환경의원", CURR_COMMITTEE: "환경노동위원회", PROPOSE_DT: "2024-05-01", LINK_URL: "https://example.com" },
      ], 1));

      registerPetitionTools(server, config);
      const tools = getRegisteredTools(server);
      const result = await tools.search_petitions.handler(
        { keyword: "환경" },
        {} as never,
      ) as ToolResult;

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.total).toBe(1);
      expect(parsed.items[0]).toMatchObject({ 청원명: "환경보호청원", 소관위원회: "환경노동위원회" });
    });

    it("네트워크 오류를 처리한다", async () => {
      mockFetchNetworkError();

      registerPetitionTools(server, config);
      const tools = getRegisteredTools(server);
      const result = await tools.search_petitions.handler({}, {} as never) as ToolResult;

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("오류");
    });
  });

  // =========================================================================
  // research.ts
  // =========================================================================

  describe("research", () => {
    it("registerResearchTools는 search_research_reports를 등록한다", () => {
      registerResearchTools(server, config);
      const tools = getRegisteredTools(server);
      expect(tools).toHaveProperty("search_research_reports");
    });

    it("입법조사처 보고서 검색 결과를 반환한다", async () => {
      mockFetchSuccess(buildAssemblyResponse("naaborihbkorknasp", [
        { TITLE: "AI 규제 동향", AUTHOR: "입법조사관", PUB_DATE: "2024-04-01", CATEGORY: "이슈와논점", LINK_URL: "https://example.com", ABSTRACT: "AI 관련 입법 동향 분석" },
      ], 1));

      registerResearchTools(server, config);
      const tools = getRegisteredTools(server);
      const result = await tools.search_research_reports.handler(
        { keyword: "AI" },
        {} as never,
      ) as ToolResult;

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.total).toBe(1);
      expect(parsed.items[0]).toMatchObject({ 제목: "AI 규제 동향", 카테고리: "이슈와논점" });
    });

    it("네트워크 오류를 처리한다", async () => {
      mockFetchNetworkError();

      registerResearchTools(server, config);
      const tools = getRegisteredTools(server);
      const result = await tools.search_research_reports.handler({}, {} as never) as ToolResult;

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("오류");
    });
  });

  // =========================================================================
  // speeches.ts (search_member_activity - complex, Promise.all)
  // =========================================================================

  describe("speeches", () => {
    it("registerSpeechTools는 search_member_activity를 등록한다", () => {
      registerSpeechTools(server, config);
      const tools = getRegisteredTools(server);
      expect(tools).toHaveProperty("search_member_activity");
    });

    it("의원 의정활동 전체를 반환한다 (member + bills + votes)", async () => {
      mockFetchSequence(
        // 1st: member info
        buildAssemblyResponse("nwvrqwxyaytdsfvhu", [
          { HG_NM: "테스트의원", POLY_NM: "더불어민주당", ORIG_NM: "서울 강남구갑", REELE_GBN_NM: "초선", CMITS: "교육위원회" },
        ], 1),
        // 2nd: bills (MEMBER_BILLS)
        buildAssemblyResponse("nzmimeepazxkubdpn", [
          { BILL_NO: "2100001", BILL_NAME: "교육법", PROC_RESULT: "계류" },
        ], 1),
        // 3rd: votes (VOTE_PLENARY)
        buildAssemblyResponse("nwbpacrgavhjryiph", [
          { BILL_NO: "2100002", BILL_NM: "환경법", PROC_RESULT_CD: "가결" },
        ], 1),
      );

      registerSpeechTools(server, config);
      const tools = getRegisteredTools(server);
      const result = await tools.search_member_activity.handler(
        { name: "테스트의원" },
        {} as never,
      ) as ToolResult;

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.total).toBe(2);
      expect(parsed.member).toMatchObject({ name: "테스트의원", party: "더불어민주당" });
      expect(parsed.items).toEqual(expect.arrayContaining([
        expect.objectContaining({ type: "bill", billName: "교육법" }),
        expect.objectContaining({ type: "vote", billName: "환경법" }),
      ]));
    });

    it("의원을 찾을 수 없으면 안내 메시지를 반환한다", async () => {
      mockFetchSuccess(buildAssemblyResponse("nwvrqwxyaytdsfvhu", [], 0));

      registerSpeechTools(server, config);
      const tools = getRegisteredTools(server);
      const result = await tools.search_member_activity.handler(
        { name: "없는의원" },
        {} as never,
      ) as ToolResult;

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.total).toBe(0);
      expect(parsed.items).toEqual([]);
    });

    it("activity_type=bills이면 발의법안만 반환한다", async () => {
      mockFetchSequence(
        buildAssemblyResponse("nwvrqwxyaytdsfvhu", [
          { HG_NM: "김의원", POLY_NM: "국민의힘", ORIG_NM: "부산 해운대구", REELE_GBN_NM: "재선", CMITS: "국방위원회" },
        ], 1),
        buildAssemblyResponse("nzmimeepazxkubdpn", [
          { BILL_NO: "2100010", BILL_NAME: "국방법", PROC_RESULT: "가결" },
        ], 1),
      );

      registerSpeechTools(server, config);
      const tools = getRegisteredTools(server);
      const result = await tools.search_member_activity.handler(
        { name: "김의원", activity_type: "bills" },
        {} as never,
      ) as ToolResult;

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.total).toBe(1);
      expect(parsed.items[0]).toMatchObject({ type: "bill", billName: "국방법" });
      expect(parsed.items.every((i: { type: string }) => i.type === "bill")).toBe(true);
    });

    it("activity_type=votes이면 표결참여만 반환한다", async () => {
      mockFetchSequence(
        buildAssemblyResponse("nwvrqwxyaytdsfvhu", [
          { HG_NM: "박의원", POLY_NM: "정의당", ORIG_NM: "비례대표", REELE_GBN_NM: "초선", CMITS: "환경노동위원회" },
        ], 1),
        buildAssemblyResponse("nwbpacrgavhjryiph", [
          { BILL_NO: "2100020", BILL_NM: "노동법", PROC_RESULT_CD: "부결" },
        ], 1),
      );

      registerSpeechTools(server, config);
      const tools = getRegisteredTools(server);
      const result = await tools.search_member_activity.handler(
        { name: "박의원", activity_type: "votes" },
        {} as never,
      ) as ToolResult;

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.total).toBe(1);
      expect(parsed.items[0]).toMatchObject({ type: "vote", billName: "노동법" });
      expect(parsed.items.every((i: { type: string }) => i.type === "vote")).toBe(true);
    });

    it("네트워크 오류를 처리한다", async () => {
      mockFetchNetworkError();

      registerSpeechTools(server, config);
      const tools = getRegisteredTools(server);
      const result = await tools.search_member_activity.handler(
        { name: "테스트" },
        {} as never,
      ) as ToolResult;

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("오류");
    });
  });

  // =========================================================================
  // votes.ts
  // =========================================================================

  describe("votes", () => {
    it("registerVoteTools는 get_vote_results를 등록한다", () => {
      registerVoteTools(server, config);
      const tools = getRegisteredTools(server);
      expect(tools).toHaveProperty("get_vote_results");
    });

    it("표결 결과를 반환한다", async () => {
      mockFetchSuccess(buildAssemblyResponse("ncocpgfiaoituanbr", [
        { BILL_ID: "PRC_TEST01", BILL_NAME: "테스트법안", HG_NM: "홍길동", VOTE_RESULT: "찬성" },
        { BILL_ID: "PRC_TEST01", BILL_NAME: "테스트법안", HG_NM: "김철수", VOTE_RESULT: "반대" },
      ], 2));

      registerVoteTools(server, config);
      const tools = getRegisteredTools(server);
      const result = await tools.get_vote_results.handler(
        { bill_id: "PRC_TEST01" },
        {} as never,
      ) as ToolResult;

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.total).toBe(2);
      expect(parsed.items).toEqual(expect.arrayContaining([
        expect.objectContaining({ 의원명: "홍길동", 표결결과: "찬성" }),
        expect.objectContaining({ 의원명: "김철수", 표결결과: "반대" }),
      ]));
    });

    it("네트워크 오류를 처리한다", async () => {
      mockFetchNetworkError();

      registerVoteTools(server, config);
      const tools = getRegisteredTools(server);
      const result = await tools.get_vote_results.handler(
        { bill_id: "PRC_TEST01" },
        {} as never,
      ) as ToolResult;

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("오류");
    });
  });
});
