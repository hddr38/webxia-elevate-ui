import { createFileRoute } from "@tanstack/react-router";
import {
  handleChatRequest,
  chatSecurityMiddleware,
  generateRequestId,
  type ChatHandlerContext,
} from "@/server/functions/chat";
import type { SessionUser } from "@/lib/auth/session";

export const Route = createFileRoute("/api/chat")({
  server: {
    middleware: [chatSecurityMiddleware],
    handlers: {
      POST: async ({ request, context }) => {
        const ctx = context as unknown as {
          request?: Request;
          user?: SessionUser | null;
          sanitizedBody?: Record<string, unknown>;
          requestId?: string;
        };

        const handlerContext: ChatHandlerContext = {
          request: (ctx.request ?? request) as Request,
          user: ctx.user ?? null,
          sanitizedBody: ctx.sanitizedBody ?? {},
          requestId:
            typeof ctx.requestId === "string" && ctx.requestId.length > 0
              ? ctx.requestId
              : generateRequestId(),
        };

        return handleChatRequest(handlerContext);
      },
    },
  },
});
