/**
 * 의원 발언/의정활동 도구
 *
 * - search_member_activity: 의원별 의정활동 검색 (발의 법안 + 본회의 표결)
 *
 * 참고: 회의록 기반 발언 검색 API 코드가 아직 확인되지 않아,
 * 검증된 API(발의법률안 + 본회의 표결)를 조합하여 의원별 활동을 제공합니다.
 */

import { z } from "zod";
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { type AppConfig } from "../config.js";
import { createApiClient } from "../api/client.js";
import { API_CODES, CURRENT_AGE } from "../api/codes.js";

export function registerSpeechTools(
  server: McpServer,
  config: AppConfig,
): void {
  const api = createApiClient(config);

  server.tool(
    "search_member_activity",
    "국회의원의 의정활동을 검색합니다. 이름으로 발의 법안 목록과 본회의 표결 참여 정보를 조합하여 반환하거나, 키워드로 관련 의안을 발의한 의원을 검색합니다.",
    {
      name: z.string().optional().describe("의원 이름 (정확한 이름). name 또는 keyword 중 하나는 필수"),
      keyword: z.string().optional().describe("검색 키워드 (의안명 검색). name 없이 사용 시 해당 키워드 관련 의안 발의자 요약을 반환"),
      age: z.number().optional().describe("대수 (기본: 22 = 제22대 국회)"),
      activity_type: z
        .enum(["all", "bills", "votes"])
        .optional()
        .describe("활동 유형 (all=전체, bills=발의법안, votes=표결참여, 기본: all)"),
      page_size: z.number().optional().describe("페이지 크기 (기본: 10)"),
    },
    async (params) => {
      try {
        const age = params.age ?? CURRENT_AGE;
        const activityType = params.activity_type ?? "all";
        const pageSize = Math.min(params.page_size ?? 10, config.apiResponse.maxPageSize);

        // name과 keyword 둘 다 없으면 에러
        if (!params.name && !params.keyword) {
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({ error: "name 또는 keyword 중 하나는 필수입니다.", code: "INVALID_PARAMS" }),
            }],
            isError: true,
          };
        }

        // 키워드만 제공된 경우: 해당 키워드로 의안 검색 후 발의자 요약 반환
        if (!params.name && params.keyword) {
          const billResult = await api.fetchOpenAssembly(API_CODES.MEMBER_BILLS, {
            AGE: age,
            BILL_NAME: params.keyword,
            pSize: pageSize,
          });

          // 발의자별 의안 수 집계
          const proposerMap = new Map<string, { count: number; bills: string[] }>();
          for (const row of billResult.rows) {
            const proposer = String(row.PROPOSER ?? "알수없음");
            const entry = proposerMap.get(proposer) ?? { count: 0, bills: [] };
            entry.count += 1;
            if (entry.bills.length < 3) {
              entry.bills.push(String(row.BILL_NAME ?? ""));
            }
            proposerMap.set(proposer, entry);
          }

          const items = Array.from(proposerMap.entries())
            .sort((a, b) => b[1].count - a[1].count)
            .slice(0, 10)
            .map(([name, info]) => ({
              type: "keyword_proposer" as const,
              proposer: name,
              billCount: info.count,
              sampleBills: info.bills,
            }));

          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                total: items.length,
                items,
                member: null,
                query: { keyword: params.keyword, age },
              }),
            }],
          };
        }

        // 의원 기본 정보
        const memberResult = await api.fetchOpenAssembly(API_CODES.MEMBER_INFO, {
          HG_NM: params.name!,
          pSize: 1,
        });

        if (memberResult.rows.length === 0) {
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({ total: 0, items: [], query: { name: params.name } }),
            }],
          };
        }

        const member = memberResult.rows[0]!;
        const memberInfo = {
          name: member.HG_NM,
          party: member.POLY_NM,
          district: member.ORIG_NM,
          reelection: member.REELE_GBN_NM,
          committees: member.CMITS,
        };

        // 발의 법안 + 본회의 표결을 병렬 조회 (Promise.all)
        const wantBills = activityType === "all" || activityType === "bills";
        const wantVotes = activityType === "all" || activityType === "votes";

        const [billResult, voteResult] = await Promise.all([
          wantBills
            ? api.fetchOpenAssembly(API_CODES.MEMBER_BILLS, { AGE: age, PROPOSER: params.name!, pSize: pageSize })
            : Promise.resolve(null),
          wantVotes
            ? api.fetchOpenAssembly(API_CODES.VOTE_PLENARY, { AGE: age, pSize: pageSize })
            : Promise.resolve(null),
        ]);

        // 활동 항목을 단일 items 배열로 통합 (Issue 6)
        const items: Record<string, unknown>[] = [];

        if (billResult) {
          for (const row of billResult.rows) {
            items.push({
              type: "bill",
              billNo: row.BILL_NO,
              billName: row.BILL_NAME,
              status: row.PROC_RESULT ?? "계류",
            });
          }
        }

        if (voteResult) {
          for (const row of voteResult.rows) {
            items.push({
              type: "vote",
              billNo: row.BILL_NO,
              billName: row.BILL_NM,
              result: row.PROC_RESULT_CD ?? row.BILL_KIND,
            });
          }
        }

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              total: items.length,
              items,
              member: memberInfo,
            }),
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
