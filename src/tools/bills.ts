/**
 * 의안 정보 도구
 *
 * - search_bills: 의안 검색
 * - get_bill_detail: 의안 상세 조회
 */

import { z } from "zod";
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { type AppConfig } from "../config.js";
import { createApiClient } from "../api/client.js";
import { API_CODES, CURRENT_AGE } from "../api/codes.js";

export function registerBillTools(
  server: McpServer,
  config: AppConfig,
): void {
  const api = createApiClient(config);

  server.tool(
    "search_bills",
    "국회 의안(법률안)을 검색합니다. 의안명, 대수, 제안자, 소관위원회, 처리상태로 필터링할 수 있습니다.",
    {
      bill_name: z.string().optional().describe("의안명 (부분 일치 검색)"),
      age: z.number().optional().describe("대수 (예: 22 = 제22대 국회)"),
      proposer: z.string().optional().describe("제안자/대표발의자 이름"),
      committee: z.string().optional().describe("소관위원회명"),
      status: z.string().optional().describe("처리상태 (예: 계류, 원안가결, 수정가결, 폐기 등)"),
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
        if (params.committee) queryParams.COMMITTEE = params.committee;
        if (params.status) queryParams.PROC_RESULT = params.status;
        if (params.page) queryParams.pIndex = params.page;
        if (params.page_size) queryParams.pSize = Math.min(params.page_size, config.apiResponse.maxPageSize);

        const result = await api.fetchOpenAssembly(
          API_CODES.MEMBER_BILLS,
          queryParams,
        );

        const formatted = result.rows.map((row) => ({
          의안ID: row.BILL_ID,
          의안번호: row.BILL_NO,
          의안명: row.BILL_NAME,
          제안자: row.PROPOSER,
          대수: row.AGE,
          소관위원회: row.COMMITTEE,
          제안일: row.PROPOSE_DT,
          처리상태: row.PROC_RESULT,
          처리일: row.PROC_DT,
          상세링크: row.DETAIL_LINK,
        }));

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ total: result.totalCount, items: formatted }),
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

  server.tool(
    "get_bill_detail",
    "특정 의안의 상세 정보를 조회합니다. 의안ID로 검색하여 심사경과, 제안이유, 주요내용 등을 반환합니다.",
    {
      bill_id: z.string().describe("의안 ID"),
      age: z.number().optional().describe("대수 (예: 22)"),
    },
    async (params) => {
      try {
        const queryParams: Record<string, string | number> = {
          BILL_ID: params.bill_id,
          AGE: params.age ?? CURRENT_AGE,
        };

        const result = await api.fetchOpenAssembly(
          API_CODES.BILL_DETAIL,
          queryParams,
        );

        if (result.rows.length === 0) {
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({ total: 0, items: [], query: { bill_id: params.bill_id } }),
            }],
          };
        }

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ total: 1, items: [result.rows[0]] }),
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
