/**
 * MCP 서버 초기화 및 도구 등록
 *
 * McpServer 인스턴스를 생성하고, 모든 국회 API 도구를 등록합니다.
 * config.server.transport 설정에 따라 stdio 또는 HTTP 전송을 사용합니다.
 */

import {
  createServer as createHttpServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { type AppConfig } from "./config.js";
import { registerLiteTools } from "./tools/lite/index.js";
import { registerLiteRecordTools } from "./tools/lite/records.js";
import { registerLiteChainTools } from "./tools/lite/chains.js";
import { registerLiteMemberTools } from "./tools/lite/members.js";
import { registerMemberTools } from "./tools/members.js";
import { registerBillTools } from "./tools/bills.js";
import { registerScheduleTools } from "./tools/schedule.js";
import { registerMeetingTools } from "./tools/meetings.js";
import { registerCommitteeTools } from "./tools/committees.js";
import { registerVoteTools } from "./tools/votes.js";
import { registerPetitionTools } from "./tools/petitions.js";
import { registerLegislationTools } from "./tools/legislation.js";
import { registerLibraryTools } from "./tools/library.js";
import { registerBudgetTools } from "./tools/budget.js";
import { registerResearchTools } from "./tools/research.js";
import { registerSpeechTools } from "./tools/speeches.js";
import { registerBillExtraTools } from "./tools/bill-extras.js";
import { registerDiscoverTools } from "./tools/discover.js";
import { registerQueryTools } from "./tools/query.js";
import { registerResources } from "./resources/static-data.js";
import { registerPrompts } from "./prompts/templates.js";

// ---------------------------------------------------------------------------
// MCP Server factory (transport-agnostic)
// ---------------------------------------------------------------------------

function buildMcpServer(config: AppConfig): McpServer {
  const server = new McpServer({
    name: "assembly-api-mcp",
    version: "0.2.0",
  });

  // 도구 등록 — 프로필에 따라 분기
  if (config.profile === "full") {
    // Full 프로필: 기존 23개 도구 전부
    registerMemberTools(server, config);
    registerBillTools(server, config);
    registerScheduleTools(server, config);
    registerMeetingTools(server, config);
    registerCommitteeTools(server, config);
    registerVoteTools(server, config);
    registerPetitionTools(server, config);
    registerLegislationTools(server, config);
    registerLibraryTools(server, config);
    registerBudgetTools(server, config);
    registerResearchTools(server, config);
    registerSpeechTools(server, config);
    registerBillExtraTools(server, config);
    registerDiscoverTools(server, config);
    registerQueryTools(server, config);
    // Full 프로필에 lite-only 도구 추가 (search_records, analyze_legislator, track_legislation)
    // search_bills/search_members는 full에 이미 같은 이름으로 존재하므로 제외
    // discover_apis/query_assembly도 이미 등록됨
    registerLiteRecordTools(server, config);
    registerLiteChainTools(server, config);
    registerLiteMemberTools(server, config);
  } else {
    // Lite 프로필 (기본): 7개 도구
    registerLiteTools(server, config);
  }

  // 리소스 등록
  registerResources(server, config);

  // 프롬프트 등록
  registerPrompts(server);

  return server;
}

// ---------------------------------------------------------------------------
// Stdio transport
// ---------------------------------------------------------------------------

async function startStdioTransport(config: AppConfig): Promise<McpServer> {
  const server = buildMcpServer(config);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  return server;
}

// ---------------------------------------------------------------------------
// Streamable HTTP transport
// ---------------------------------------------------------------------------

const MCP_ENDPOINT = "/mcp";

/** Session entry — transport + last-used timestamp for cleanup */
interface SessionEntry {
  transport: StreamableHTTPServerTransport;
  server: McpServer;
  lastUsed: number;
}

/** Session TTL: 30 minutes */
const SESSION_TTL_MS = 30 * 60 * 1000;

/** Session cleanup interval: 5 minutes */
const SESSION_CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

async function startHttpTransport(config: AppConfig): Promise<McpServer> {
  const sessions = new Map<string, SessionEntry>();

  // Periodic cleanup of stale sessions
  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [id, entry] of sessions) {
      if (now - entry.lastUsed > SESSION_TTL_MS) {
        process.stderr.write(
          `[assembly-api-mcp] 세션 만료, 정리합니다: ${id}\n`,
        );
        void entry.transport.close();
        sessions.delete(id);
      }
    }
  }, SESSION_CLEANUP_INTERVAL_MS);
  cleanupTimer.unref();

  const httpServer = createHttpServer(
    (req: IncomingMessage, res: ServerResponse) => {
      const url = req.url ?? "/";

      // Health-check endpoint
      if (url === "/health" && req.method === "GET") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "ok", sessions: sessions.size }));
        return;
      }

      // MCP endpoint — per-session transport routing
      if (url === MCP_ENDPOINT) {
        void handleMcpRequest(req, res, config, sessions);
        return;
      }

      // Everything else → 404
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not found" }));
    },
  );

  const { port } = config.server;

  await new Promise<void>((resolve, reject) => {
    httpServer.on("error", reject);
    httpServer.listen(port, () => {
      process.stderr.write(
        `[assembly-api-mcp] HTTP 서버가 포트 ${String(port)}에서 시작되었습니다. (엔드포인트: ${MCP_ENDPOINT})\n`,
      );
      resolve();
    });
  });

  // Graceful shutdown
  const shutdown = async (): Promise<void> => {
    process.stderr.write("[assembly-api-mcp] 서버를 종료합니다...\n");
    clearInterval(cleanupTimer);
    const closePromises = Array.from(sessions.values()).map((entry) =>
      entry.transport.close(),
    );
    await Promise.all(closePromises);
    sessions.clear();
    httpServer.close();
  };

  process.on("SIGINT", () => {
    void shutdown();
  });
  process.on("SIGTERM", () => {
    void shutdown();
  });

  // Return a "template" server instance (not bound to any session)
  return buildMcpServer(config);
}

async function handleMcpRequest(
  req: IncomingMessage,
  res: ServerResponse,
  config: AppConfig,
  sessions: Map<string, SessionEntry>,
): Promise<void> {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;

  // Existing session — route to stored transport
  if (sessionId && sessions.has(sessionId)) {
    const entry = sessions.get(sessionId)!;
    entry.lastUsed = Date.now();
    await entry.transport.handleRequest(req, res);
    return;
  }

  // New session — only allowed via POST (initialization) or when no session ID
  if (!sessionId && req.method === "POST") {
    const newTransport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
    });
    const newServer = buildMcpServer(config);
    await newServer.connect(newTransport);

    // Handle the request (this will generate the session ID in the response)
    await newTransport.handleRequest(req, res);

    // Store the session using the transport's generated session ID
    const newSessionId = newTransport.sessionId;
    if (newSessionId) {
      sessions.set(newSessionId, {
        transport: newTransport,
        server: newServer,
        lastUsed: Date.now(),
      });
      process.stderr.write(
        `[assembly-api-mcp] 새 세션 생성: ${newSessionId} (총 ${sessions.size}개)\n`,
      );

      // Clean up when transport closes
      newTransport.onclose = () => {
        sessions.delete(newSessionId);
        process.stderr.write(
          `[assembly-api-mcp] 세션 종료: ${newSessionId} (남은 ${sessions.size}개)\n`,
        );
      };
    }
    return;
  }

  // Invalid or expired session
  res.writeHead(400, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Invalid or expired session" }));
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export async function createServer(config: AppConfig): Promise<McpServer> {
  if (config.server.transport === "http") {
    return startHttpTransport(config);
  }
  return startStdioTransport(config);
}
