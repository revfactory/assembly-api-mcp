/**
 * 국민동의청원 도구
 *
 * - search_petitions: 국민동의청원 검색
 */

import { z } from "zod";
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { type AppConfig } from "../config.js";
import { createApiClient } from "../api/client.js";
import { API_CODES } from "../api/codes.js";

export function registerPetitionTools(
  server: McpServer,
  config: AppConfig,
): void {
  const api = createApiClient(config);

  server.tool(
    "search_petitions",
    "국민동의청원을 검색합니다. 키워드, 처리상태로 필터링할 수 있습니다.",
    {
      keyword: z.string().optional().describe("검색 키워드 (청원 제목 검색)"),
      status: z.string().optional().describe("처리상태 (예: 접수, 심사중, 종료 등)"),
      page: z.number().optional().describe("페이지 번호 (기본: 1)"),
      page_size: z.number().optional().describe("페이지 크기 (기본: 20, 최대: 100)"),
    },
    async (params) => {
      try {
        const queryParams: Record<string, string | number> = {};
        if (params.keyword) queryParams.BILL_NAME = params.keyword;
        if (params.page) queryParams.pIndex = params.page;
        if (params.page_size) queryParams.pSize = Math.min(params.page_size, config.apiResponse.maxPageSize);

        const result = await api.fetchOpenAssembly(
          API_CODES.PETITION_PENDING,
          queryParams,
        );

        // BILL_NAME은 정확 일치일 수 있으므로, 키워드가 있으면 제목 포함 여부로 추가 필터링
        let rows = result.rows;
        if (params.keyword) {
          const kw = params.keyword.toLowerCase();
          rows = rows.filter((row) =>
            String(row.BILL_NAME ?? "").toLowerCase().includes(kw),
          );
        }

        const formatted = rows.map((row) => ({
          청원번호: row.BILL_NO,
          청원명: row.BILL_NAME,
          청원인: row.PROPOSER,
          소개의원: row.APPROVER,
          소관위원회: row.CURR_COMMITTEE,
          제출일: row.PROPOSE_DT,
          링크: row.LINK_URL,
        }));

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ total: formatted.length, items: formatted }),
          }],
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        const code = message.includes('API_KEY') ? 'AUTH_ERROR'
          : message.includes('rate') ? 'RATE_LIMIT'
          : message.includes('timeout') ? 'TIMEOUT'
          : 'UNKNOWN';
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: message, code }) }],
          isError: true,
        };
      }
    },
  );
}
