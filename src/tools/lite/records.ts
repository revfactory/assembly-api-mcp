/**
 * Lite 통합 기록 도구
 *
 * get_schedule + search_meeting_records + get_vote_results를
 * 단일 search_records 도구로 통합합니다.
 */

import { z } from "zod";
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { type AppConfig } from "../../config.js";
import { createApiClient } from "../../api/client.js";
import { API_CODES, CURRENT_AGE } from "../../api/codes.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RecordType = "schedule" | "meetings" | "votes";

type MeetingType =
  | "본회의"
  | "위원회"
  | "국정감사"
  | "인사청문회"
  | "공청회";

interface SearchParams {
  readonly type: RecordType;
  readonly keyword?: string;
  readonly committee?: string;
  readonly date_from?: string;
  readonly date_to?: string;
  readonly bill_id?: string;
  readonly age?: number;
  readonly meeting_type?: MeetingType;
  readonly page?: number;
  readonly page_size?: number;
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function formatScheduleRow(
  row: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  return {
    일정종류: row.SCH_KIND,
    일자: row.SCH_DT,
    시간: row.SCH_TM,
    위원회: row.CMIT_NM,
    내용: row.SCH_CN,
    장소: row.EV_PLC,
  };
}

function formatMeetingRow(
  row: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  return {
    회의명: row.TITLE ?? row.COMM_NAME ?? row.CLASS_NAME,
    회의일: row.CONF_DATE,
    대수: row.DAE_NUM ?? row.ERACO,
    안건: row.SUB_NAME,
    회의록URL: row.PDF_LINK_URL ?? row.CONF_LINK_URL ?? row.LINK_URL,
    영상URL: row.VOD_LINK_URL,
  };
}

function formatVoteRow(
  row: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  return {
    의안ID: row.BILL_ID,
    의안명: row.BILL_NAME,
    의원명: row.HG_NM,
    표결결과: row.VOTE_RESULT,
  };
}

const RESULT_LABELS: Readonly<Record<RecordType, string>> = {
  schedule: "국회 일정",
  meetings: "회의록 검색 결과",
  votes: "표결 결과",
};

// ---------------------------------------------------------------------------
// Query builders
// ---------------------------------------------------------------------------

function buildScheduleQuery(
  params: SearchParams,
  maxPageSize: number,
): { readonly apiCode: string; readonly queryParams: Record<string, string | number> } {
  const queryParams: Record<string, string | number> = {};

  // date_from만 있으면 SCH_DT로 정확한 날짜 조회
  // date_from + date_to 모두 있으면 SCH_DT 없이 조회 후 코드에서 필터링
  const hasDateRange = params.date_from && params.date_to;
  if (params.date_from && !hasDateRange) {
    queryParams.SCH_DT = params.date_from.replace(/-/g, "");
  }
  if (params.committee) {
    queryParams.CMIT_NM = params.committee;
  }
  if (params.page) queryParams.pIndex = params.page;

  // 날짜 범위 필터링 시 더 많은 결과를 가져옴
  if (hasDateRange) {
    queryParams.pSize = Math.min(params.page_size ?? 100, maxPageSize);
  } else if (params.page_size) {
    queryParams.pSize = Math.min(params.page_size, maxPageSize);
  }

  return { apiCode: API_CODES.SCHEDULE_ALL, queryParams };
}

function buildMeetingsQuery(
  params: SearchParams,
  maxPageSize: number,
): { readonly apiCode: string; readonly queryParams: Record<string, string | number> } {
  const age = params.age ?? CURRENT_AGE;
  const queryParams: Record<string, string | number> = {};

  if (params.keyword) queryParams.SUB_NAME = params.keyword;
  if (params.page) queryParams.pIndex = params.page;
  if (params.page_size) {
    queryParams.pSize = Math.min(params.page_size, maxPageSize);
  }

  let apiCode: string;

  // 참고: 회의록 API의 CONF_DATE는 연도(YYYY) 단위만 지원합니다.
  // date_from에서 연도 부분만 추출하여 사용합니다.
  switch (params.meeting_type) {
    case "본회의":
      apiCode = API_CODES.MEETING_PLENARY;
      queryParams.DAE_NUM = age;
      queryParams.CONF_DATE =
        params.date_from?.slice(0, 4) ?? String(new Date().getFullYear());
      break;
    case "국정감사":
      apiCode = API_CODES.MEETING_AUDIT;
      queryParams.ERACO = `제${age}대`;
      break;
    case "인사청문회":
      apiCode = API_CODES.MEETING_CONFIRMATION;
      queryParams.ERACO = `제${age}대`;
      break;
    case "공청회":
      apiCode = API_CODES.MEETING_PUBLIC_HEARING;
      queryParams.ERACO = `제${age}대`;
      break;
    default:
      apiCode = API_CODES.MEETING_COMMITTEE;
      queryParams.DAE_NUM = age;
      queryParams.CONF_DATE =
        params.date_from?.slice(0, 4) ?? String(new Date().getFullYear());
      if (params.committee) queryParams.COMM_NAME = params.committee;
      break;
  }

  return { apiCode, queryParams };
}

function buildVotesQuery(
  params: SearchParams,
  maxPageSize: number,
): { readonly apiCode: string; readonly queryParams: Record<string, string | number> } {
  if (!params.bill_id) {
    throw new Error(
      "type='votes'에는 bill_id가 필수입니다. 의안 ID를 입력해 주세요.",
    );
  }

  const queryParams: Record<string, string | number> = {
    BILL_ID: params.bill_id,
    AGE: params.age ?? CURRENT_AGE,
  };

  if (params.page) queryParams.pIndex = params.page;
  if (params.page_size) {
    queryParams.pSize = Math.min(params.page_size, maxPageSize);
  }

  return { apiCode: API_CODES.VOTE_BY_BILL, queryParams };
}

const QUERY_BUILDERS: Readonly<
  Record<
    RecordType,
    (
      params: SearchParams,
      maxPageSize: number,
    ) => { readonly apiCode: string; readonly queryParams: Record<string, string | number> }
  >
> = {
  schedule: buildScheduleQuery,
  meetings: buildMeetingsQuery,
  votes: buildVotesQuery,
};

const ROW_FORMATTERS: Readonly<
  Record<
    RecordType,
    (row: Readonly<Record<string, unknown>>) => Record<string, unknown>
  >
> = {
  schedule: formatScheduleRow,
  meetings: formatMeetingRow,
  votes: formatVoteRow,
};

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function registerLiteRecordTools(
  server: McpServer,
  config: AppConfig,
): void {
  const api = createApiClient(config);

  server.tool(
    "search_records",
    "국회 기록을 조회합니다. type으로 일정(schedule), 회의록(meetings), 표결(votes)을 선택합니다.",
    {
      type: z
        .enum(["schedule", "meetings", "votes"])
        .describe("조회 유형: schedule(일정), meetings(회의록), votes(표결)"),
      keyword: z.string().optional().describe("검색 키워드"),
      committee: z.string().optional().describe("위원회명"),
      date_from: z
        .string()
        .optional()
        .describe("시작 날짜 (YYYY-MM-DD 형식). 회의록은 연도(YYYY)만 지원"),
      date_to: z
        .string()
        .optional()
        .describe("종료 날짜 (YYYY-MM-DD 형식). type='schedule'에서 date_from과 함께 사용 시 날짜 범위 필터링"),
      bill_id: z
        .string()
        .optional()
        .describe("의안 ID (type='votes'에서 필수)"),
      age: z
        .number()
        .optional()
        .describe(`대수 (기본: ${CURRENT_AGE} = 제${CURRENT_AGE}대 국회)`),
      meeting_type: z
        .enum(["본회의", "위원회", "국정감사", "인사청문회", "공청회"])
        .optional()
        .describe("회의 종류 (type='meetings'에서 사용)"),
      page: z.number().optional().describe("페이지 번호 (기본: 1)"),
      page_size: z
        .number()
        .optional()
        .describe("페이지 크기 (기본: 20, 최대: 100)"),
    },
    async (params) => {
      try {
        const recordType = params.type;
        const buildQuery = QUERY_BUILDERS[recordType];
        const formatRow = ROW_FORMATTERS[recordType];

        const { apiCode, queryParams } = buildQuery(
          params as SearchParams,
          config.apiResponse.maxPageSize,
        );

        const result = await api.fetchOpenAssembly(apiCode, queryParams);

        let rows = result.rows;

        // 일정(schedule) 타입: 날짜 범위 + 키워드 post-fetch 필터링
        if (recordType === "schedule") {
          const sp = params as SearchParams;
          if (sp.date_from && sp.date_to) {
            const from = sp.date_from.replace(/-/g, "");
            const to = sp.date_to.replace(/-/g, "");
            rows = rows.filter((row) => {
              const dt = String(row.SCH_DT ?? "");
              return dt >= from && dt <= to;
            });
          }
          if (sp.keyword) {
            const kw = sp.keyword.toLowerCase();
            rows = rows.filter((row) =>
              String(row.SCH_CN ?? "").toLowerCase().includes(kw),
            );
          }
        }

        const formatted = rows.map(formatRow);
        const label = RESULT_LABELS[recordType];

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ total: formatted.length, items: formatted }),
            },
          ],
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
