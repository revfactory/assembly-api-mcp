/**
 * 국회 일정 도구
 *
 * - get_schedule: 본회의/위원회 일정 조회
 */

import { z } from "zod";
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { type AppConfig } from "../config.js";
import { createApiClient } from "../api/client.js";
import { API_CODES } from "../api/codes.js";

export function registerScheduleTools(
  server: McpServer,
  config: AppConfig,
): void {
  const api = createApiClient(config);

  server.tool(
    "get_schedule",
    "국회 일정을 조회합니다. 본회의, 위원회, 소위원회 일정을 날짜별/위원회별로 검색할 수 있습니다.",
    {
      date_from: z.string().optional().describe("시작 날짜 (YYYY-MM-DD 형식). date_to 없이 단독 사용 시 해당 날짜의 일정만 조회"),
      date_to: z.string().optional().describe("종료 날짜 (YYYY-MM-DD 형식). date_from과 함께 사용 시 날짜 범위로 필터링 (결과를 가져온 후 코드에서 필터링)"),
      keyword: z.string().optional().describe("검색 키워드 (일정 내용에서 검색)"),
      committee: z.string().optional().describe("위원회명"),
      meeting_type: z
        .enum(["본회의", "전체회의", "소위원회", "공청회", "청문회"])
        .optional()
        .describe("회의 종류"),
      page: z.number().optional().describe("페이지 번호 (기본: 1)"),
      page_size: z.number().optional().describe("페이지 크기 (기본: 20, 최대: 100)"),
    },
    async (params) => {
      try {
        const queryParams: Record<string, string | number> = {};

        // date_from만 있으면 SCH_DT로 정확한 날짜 조회
        // date_from + date_to 모두 있으면 SCH_DT 없이 조회 후 코드에서 필터링
        const hasDateRange = params.date_from && params.date_to;
        if (params.date_from && !hasDateRange) {
          queryParams.SCH_DT = params.date_from.replace(/-/g, "");
        }
        if (params.committee) queryParams.CMIT_NM = params.committee;
        if (params.page) queryParams.pIndex = params.page;

        // 날짜 범위 필터링 시 더 많은 결과를 가져옴
        if (hasDateRange) {
          queryParams.pSize = Math.min(params.page_size ?? 100, config.apiResponse.maxPageSize);
        } else if (params.page_size) {
          queryParams.pSize = Math.min(params.page_size, config.apiResponse.maxPageSize);
        }

        // 통합 일정 API 사용 (90,201건, 모든 일정 포함)
        const apiCode = API_CODES.SCHEDULE_ALL;

        const result = await api.fetchOpenAssembly(apiCode, queryParams);

        let rows = result.rows;

        // 날짜 범위 필터링 (date_from + date_to)
        if (hasDateRange) {
          const from = params.date_from!.replace(/-/g, "");
          const to = params.date_to!.replace(/-/g, "");
          rows = rows.filter((row) => {
            const dt = String(row.SCH_DT ?? "");
            return dt >= from && dt <= to;
          });
        }

        // 키워드 필터링 (SCH_CN 내용 필드에서 검색)
        if (params.keyword) {
          const kw = params.keyword.toLowerCase();
          rows = rows.filter((row) =>
            String(row.SCH_CN ?? "").toLowerCase().includes(kw),
          );
        }

        const formatted = rows.map((row) => ({
          일정종류: row.SCH_KIND,
          일자: row.SCH_DT,
          시간: row.SCH_TM,
          위원회: row.CMIT_NM,
          내용: row.SCH_CN,
          장소: row.EV_PLC,
          회기: row.CONF_SESS,
          차수: row.CONF_DGR,
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
