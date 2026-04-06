/**
 * 국회의원 정보 도구
 *
 * - get_members: 국회의원 검색 (이름/정당/지역구)
 * - get_member_detail: 특정 의원 상세 정보
 */

import { z } from "zod";
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { type AppConfig } from "../config.js";
import { createApiClient } from "../api/client.js";
import { API_CODES } from "../api/codes.js";

export function registerMemberTools(
  server: McpServer,
  config: AppConfig,
): void {
  const api = createApiClient(config);

  server.tool(
    "get_members",
    "국회의원을 검색합니다. 이름, 정당, 선거구, 대수(회기)로 필터링할 수 있습니다.",
    {
      name: z.string().optional().describe("의원 이름 (부분 일치 검색)"),
      party: z.string().optional().describe("정당명"),
      district: z.string().optional().describe("선거구명"),
      age: z.number().optional().describe("대수 (예: 22 = 제22대 국회)"),
      page: z.number().optional().describe("페이지 번호 (기본: 1)"),
      page_size: z.number().optional().describe("페이지 크기 (기본: 20, 최대: 100)"),
    },
    async (params) => {
      try {
        const queryParams: Record<string, string | number> = {};
        if (params.name) queryParams.HG_NM = params.name;
        if (params.party) queryParams.POLY_NM = params.party;
        if (params.district) queryParams.ORIG_NM = params.district;
        // MEMBER_INFO API는 UNIT_CD가 아닌 AGE 불필요 (현재 의원만 반환)
        // age 파라미터는 무시 — UNIT_CD 형식 오류로 빈 결과 반환 방지
        if (params.page) queryParams.pIndex = params.page;
        if (params.page_size) queryParams.pSize = Math.min(params.page_size, config.apiResponse.maxPageSize);

        const result = await api.fetchOpenAssembly(
          API_CODES.MEMBER_INFO,
          queryParams,
        );

        const formatted = result.rows.map((row) => ({
          이름: row.HG_NM,
          한자: row.HJ_NM,
          영문: row.ENG_NM,
          정당: row.POLY_NM,
          선거구: row.ORIG_NM,
          당선횟수: row.REELE_GBN_NM,
          당선방법: row.ELECT_GBN_NM,
          소속위원회: row.CMITS,
          연락처: row.TEL_NO,
          이메일: row.E_MAIL,
          홈페이지: row.HOMEPAGE,
          사무실: row.STAFF,
          보좌관: row.SECRETARY,
          비서관: row.SECRETARY2,
          사진: row.MONA_CD ? `https://www.assembly.go.kr/photo/${String(row.MONA_CD)}.jpg` : '',
          의원코드: row.MONA_CD,
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
    "get_member_detail",
    "특정 국회의원의 상세 정보를 조회합니다. 이름으로 검색하여 상세 이력, 발의 법안 수, SNS 정보 등을 반환합니다.",
    {
      name: z.string().describe("의원 이름 (정확한 이름)"),
      age: z.number().optional().describe("대수 (예: 22 = 제22대 국회)"),
    },
    async (params) => {
      try {
        const queryParams: Record<string, string | number> = {
          HG_NM: params.name,
        };
        // MEMBER_INFO API는 UNIT_CD가 아닌 AGE 불필요 (현재 의원만 반환)
        // age 파라미터는 무시 — UNIT_CD 형식 오류로 빈 결과 반환 방지

        const result = await api.fetchOpenAssembly(
          API_CODES.MEMBER_INFO,
          queryParams,
        );

        if (result.rows.length === 0) {
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({ total: 0, items: [], query: { name: params.name } }),
            }],
          };
        }

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ total: 1, item: result.rows[0] }),
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
