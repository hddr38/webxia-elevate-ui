import { createMiddleware } from "@tanstack/react-start";
import { getSessionUser, requireSessionUser } from "./session";

export const adminMiddleware = createMiddleware({ type: "request" }).server(
  async ({ request, next }) => {
    const user = await requireSessionUser(request);
    return next({ context: { user, request } });
  },
);

export const optionalAdminMiddleware = createMiddleware({ type: "request" }).server(
  async ({ request, next }) => {
    const user = await getSessionUser(request);
    return next({ context: { user, request } });
  },
);
