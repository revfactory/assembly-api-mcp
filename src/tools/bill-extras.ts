/**
 * 의안 추가 도구
 *
 * - get_pending_bills: 계류의안 조회
 * - get_processed_bills: 처리의안 조회
 * - get_recent_bills: 최근 본회의 처리의안
 * - get_bill_review: 의안 심사정보
 * - get_plenary_votes: 본회의 표결정보
 * - search_all_bills: 의안 통합검색 (전 대수)
 * - get_bill_history: 의안 접수/처리 이력
 */

import { z } from "zod";
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { type AppConfig } from "../config.js";
import { createApiClient } from "../api/client.js";
import { API_CODES, CURRENT_AGE } from "../api/codes.js";

export function registerBillExtraTools(
  server: McpServer,
  config: AppConfig,
): void {
  const api = createApiClient(config);

  // ── 1. 계류의안 조회 ───────────────────────────────────────────

  server.tool(
    "get_pending_bills",
    "국회에 계류 중인 의안을 조회합니다. 의안명, 제안자로 필터링할 수 있습니다.",
    {
      bill_name: z.string().optional().describe("의안명 (부분 일치 검색)"),
      proposer: z.string().optional().describe("제안자/대표발의자 이름"),
      page: z.number().optional().describe("페이지 번호 (기본: 1)"),
      page_size: z.number().optional().describe("페이지 크기 (기본: 20, 최대: 100)"),
    },
    async (params) => {
      try {
        const queryParams: Record<string, string | number> = {};
        if (params.bill_name) queryParams.BILL_NAME = params.bill_name;
        if (params.proposer) queryParams.PROPOSER = params.proposer;
        if (params.page) queryParams.pIndex = params.page;
        if (params.page_size) queryParams.pSize = Math.min(params.page_size, config.apiResponse.maxPageSize);

        const result = await api.fetchOpenAssembly(
          API_CODES.BILL_PENDING,
          queryParams,
        );

        const formatted = result.rows.map((row) => ({
          의안번호: row.BILL_NO,
          의안명: row.BILL_NAME,
          제안자: row.PROPOSER,
          제안자구분: row.PROPOSER_KIND,
        }));

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ total: result.totalCount, items: formatted }),
          }],
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: message, code: message.includes('API_KEY') ? 'AUTH_ERROR' : message.includes('rate') ? 'RATE_LIMIT' : message.includes('timeout') ? 'TIMEOUT' : 'UNKNOWN' }) }],
          isError: true,
        };
      }
    },
  );

  // ── 2. 처리의안 조회 ───────────────────────────────────────────

  server.tool(
    "get_processed_bills",
    "국회에서 처리(가결/부결/폐기 등)된 의안을 조회합니다. 대수, 의안명으로 필터링할 수 있습니다.",
    {
      age: z.number().optional().describe("대수 (예: 22 = 제22대 국회, 기본: 현재 대수)"),
      bill_name: z.string().optional().describe("의안명 (부분 일치 검색)"),
      page: z.number().optional().describe("페이지 번호 (기본: 1)"),
      page_size: z.number().optional().describe("페이지 크기 (기본: 20, 최대: 100)"),
    },
    async (params) => {
      try {
        const queryParams: Record<string, string | number> = {
          AGE: params.age ?? CURRENT_AGE,
        };
        if (params.bill_name) queryParams.BILL_NAME = params.bill_name;
        if (params.page) queryParams.pIndex = params.page;
        if (params.page_size) queryParams.pSize = Math.min(params.page_size, config.apiResponse.maxPageSize);

        const result = await api.fetchOpenAssembly(
          API_CODES.BILL_PROCESSED,
          queryParams,
        );

        const formatted = result.rows.map((row) => ({
          의안번호: row.BILL_NO,
          의안명: row.BILL_NAME,
          제안자: row.PROPOSER,
          제안자구분: row.PROPOSER_KIND,
        }));

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ total: result.totalCount, items: formatted }),
          }],
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: message, code: message.includes('API_KEY') ? 'AUTH_ERROR' : message.includes('rate') ? 'RATE_LIMIT' : message.includes('timeout') ? 'TIMEOUT' : 'UNKNOWN' }) }],
          isError: true,
        };
      }
    },
  );

  // ── 3. 최근 본회의 처리의안 ────────────────────────────────────

  server.tool(
    "get_recent_bills",
    "최근 본회의에서 처리된 의안 목록을 조회합니다.",
    {
      age: z.number().optional().describe("대수 (예: 22 = 제22대 국회, 기본: 현재 대수)"),
      page: z.number().optional().describe("페이지 번호 (기본: 1)"),
      page_size: z.number().optional().describe("페이지 크기 (기본: 20, 최대: 100)"),
    },
    async (params) => {
      try {
        const queryParams: Record<string, string | number> = {
          AGE: params.age ?? CURRENT_AGE,
        };
        if (params.page) queryParams.pIndex = params.page;
        if (params.page_size) queryParams.pSize = Math.min(params.page_size, config.apiResponse.maxPageSize);

        const result = await api.fetchOpenAssembly(
          "nxjuyqnxadtotdrbw",
          queryParams,
        );

        const formatted = result.rows.map((row) => ({
          의안번호: row.BILL_NO,
          의안명: row.BILL_NAME,
          제안자: row.PROPOSER,
          제안자구분: row.PROPOSER_KIND,
        }));

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ total: result.totalCount, items: formatted }),
          }],
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: message, code: message.includes('API_KEY') ? 'AUTH_ERROR' : message.includes('rate') ? 'RATE_LIMIT' : message.includes('timeout') ? 'TIMEOUT' : 'UNKNOWN' }) }],
          isError: true,
        };
      }
    },
  );

  // ── 4. 의안 심사정보 ──────────────────────────────────────────

  server.tool(
    "get_bill_review",
    "의안의 심사 경과 정보를 조회합니다. 의안ID 또는 의안명으로 검색할 수 있습니다.",
    {
      bill_id: z.string().optional().describe("의안 ID"),
      bill_name: z.string().optional().describe("의안명 (부분 일치 검색)"),
      page: z.number().optional().describe("페이지 번호 (기본: 1)"),
      page_size: z.number().optional().describe("페이지 크기 (기본: 20, 최대: 100)"),
    },
    async (params) => {
      try {
        const queryParams: Record<string, string | number> = {};
        if (params.bill_id) queryParams.BILL_ID = params.bill_id;
        if (params.bill_name) queryParams.BILL_NM = params.bill_name;
        if (params.page) queryParams.pIndex = params.page;
        if (params.page_size) queryParams.pSize = Math.min(params.page_size, config.apiResponse.maxPageSize);

        const result = await api.fetchOpenAssembly(
          API_CODES.BILL_REVIEW,
          queryParams,
        );

        // API가 BILL_ID/BILL_NM 필터를 무시할 수 있으므로 클라이언트에서 필터링
        let filteredRows = result.rows;
        if (params.bill_id) {
          filteredRows = filteredRows.filter(
            (row) => String(row.BILL_ID ?? "") === params.bill_id,
          );
        }
        if (params.bill_name && filteredRows.length === 0) {
          // bill_id 필터 결과가 없으면 bill_name 부분 일치로 재시도
          const nameLower = params.bill_name.toLowerCase();
          filteredRows = result.rows.filter(
            (row) => String(row.BILL_NM ?? "").toLowerCase().includes(nameLower),
          );
        } else if (params.bill_name && !params.bill_id) {
          const nameLower = params.bill_name.toLowerCase();
          filteredRows = filteredRows.filter(
            (row) => String(row.BILL_NM ?? "").toLowerCase().includes(nameLower),
          );
        }

        const formatted = filteredRows.map((row) => ({
          의안번호: row.BILL_NO,
          의안명: row.BILL_NM,
          제안자구분: row.PPSR_KIND,
          제안일: row.PPSL_DT,
          소관위원회: row.JRCMIT_NM,
        }));

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              total: formatted.length,
              items: formatted,
              note: formatted.length === 0 && result.rows.length > 0
                ? "API 결과에서 해당 의안을 찾지 못했습니다. bill_id 또는 bill_name을 확인해 주세요."
                : undefined,
            }),
          }],
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: message, code: message.includes('API_KEY') ? 'AUTH_ERROR' : message.includes('rate') ? 'RATE_LIMIT' : message.includes('timeout') ? 'TIMEOUT' : 'UNKNOWN' }) }],
          isError: true,
        };
      }
    },
  );

  // ── 5. 본회의 표결정보 ─────────────────────────────────────────

  server.tool(
    "get_plenary_votes",
    "본회의 표결 정보를 조회합니다. 의안별 찬성/반대/기권 현황을 확인할 수 있습니다.",
    {
      age: z.number().optional().describe("대수 (예: 22 = 제22대 국회, 기본: 현재 대수)"),
      page: z.number().optional().describe("페이지 번호 (기본: 1)"),
      page_size: z.number().optional().describe("페이지 크기 (기본: 20, 최대: 100)"),
    },
    async (params) => {
      try {
        const queryParams: Record<string, string | number> = {
          AGE: params.age ?? CURRENT_AGE,
        };
        if (params.page) queryParams.pIndex = params.page;
        if (params.page_size) queryParams.pSize = Math.min(params.page_size, config.apiResponse.maxPageSize);

        const result = await api.fetchOpenAssembly(
          API_CODES.VOTE_PLENARY,
          queryParams,
        );

        const formatted = result.rows.map((row) => ({
          의안번호: row.BILL_NO,
          의안명: row.BILL_NM,
          제안자: row.PROPOSER,
          소관위원회: row.COMMITTEE_NM,
        }));

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ total: result.totalCount, items: formatted }),
          }],
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: message, code: message.includes('API_KEY') ? 'AUTH_ERROR' : message.includes('rate') ? 'RATE_LIMIT' : message.includes('timeout') ? 'TIMEOUT' : 'UNKNOWN' }) }],
          isError: true,
        };
      }
    },
  );

  // ── 6. 의안 통합검색 (전 대수) ─────────────────────────────────

  server.tool(
    "search_all_bills",
    "의안을 통합 검색합니다. 전 대수에 걸쳐 의안명, 제안자 등으로 검색할 수 있습니다.",
    {
      age: z.number().optional().describe("대수 (예: 22 = 제22대 국회, 기본: 현재 대수)"),
      bill_name: z.string().optional().describe("의안명 (부분 일치 검색)"),
      proposer: z.string().optional().describe("제안자/대표발의자 이름"),
      page: z.number().optional().describe("페이지 번호 (기본: 1)"),
      page_size: z.number().optional().describe("페이지 크기 (기본: 20, 최대: 100)"),
    },
    async (params) => {
      try {
        const queryParams: Record<string, string | number> = {
          AGE: params.age ?? CURRENT_AGE,
        };
        if (params.bill_name) queryParams.BILL_NAME = params.bill_name;
        if (params.proposer) queryParams.PROPOSER = params.proposer;
        if (params.page) queryParams.pIndex = params.page;
        if (params.page_size) queryParams.pSize = Math.min(params.page_size, config.apiResponse.maxPageSize);

        const result = await api.fetchOpenAssembly(
          API_CODES.BILL_SEARCH,
          queryParams,
        );

        const formatted = result.rows.map((row) => ({
          의안번호: row.BILL_NO,
          의안명: row.BILL_NAME,
          제안자: row.PROPOSER,
          제안자구분: row.PROPOSER_KIND,
        }));

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ total: result.totalCount, items: formatted }),
          }],
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: message, code: message.includes('API_KEY') ? 'AUTH_ERROR' : message.includes('rate') ? 'RATE_LIMIT' : message.includes('timeout') ? 'TIMEOUT' : 'UNKNOWN' }) }],
          isError: true,
        };
      }
    },
  );

  // ── 7. 의안 접수/처리 이력 ─────────────────────────────────────

  server.tool(
    "get_bill_history",
    "의안의 접수 및 처리 이력을 조회합니다. 의안명 또는 의안번호로 검색할 수 있습니다.",
    {
      bill_name: z.string().optional().describe("의안명 (부분 일치 검색)"),
      bill_no: z.string().optional().describe("의안번호"),
      page: z.number().optional().describe("페이지 번호 (기본: 1)"),
      page_size: z.number().optional().describe("페이지 크기 (기본: 20, 최대: 100)"),
    },
    async (params) => {
      try {
        const queryParams: Record<string, string | number> = {};
        if (params.bill_name) queryParams.BILL_NM = params.bill_name;
        if (params.bill_no) queryParams.BILL_NO = params.bill_no;
        if (params.page) queryParams.pIndex = params.page;
        if (params.page_size) queryParams.pSize = Math.min(params.page_size, config.apiResponse.maxPageSize);

        const result = await api.fetchOpenAssembly(
          API_CODES.BILL_RECEIVED,
          queryParams,
        );

        // API가 BILL_NO/BILL_NM 필터를 무시할 수 있으므로 클라이언트에서 필터링
        let filteredRows = result.rows;
        if (params.bill_no) {
          filteredRows = filteredRows.filter(
            (row) => String(row.BILL_NO ?? "") === params.bill_no,
          );
        }
        if (params.bill_name) {
          const nameLower = params.bill_name.toLowerCase();
          filteredRows = filteredRows.filter(
            (row) => String(row.BILL_NM ?? "").toLowerCase().includes(nameLower),
          );
        }

        const formatted = filteredRows.map((row) => ({
          의안번호: row.BILL_NO,
          의안명: row.BILL_NM,
          의안종류: row.BILL_KIND,
          제안자구분: row.PPSR_KIND,
          제안일: row.PPSL_DT,
          처리결과: row.PROC_RSLT,
          상세링크: row.LINK_URL,
        }));

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ total: formatted.length, items: formatted }),
          }],
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: message, code: message.includes('API_KEY') ? 'AUTH_ERROR' : message.includes('rate') ? 'RATE_LIMIT' : message.includes('timeout') ? 'TIMEOUT' : 'UNKNOWN' }) }],
          isError: true,
        };
      }
    },
  );
}
