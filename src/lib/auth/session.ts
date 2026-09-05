import { getSupabaseAdmin } from "../supabase/admin";
import { extractAccessToken } from "../utils";

export interface SessionUser {
  id: string;
  email: string;
  role: string;
  adminId: string;
}

export async function getSessionUser(request: Request): Promise<SessionUser | null> {
  const accessToken = extractAccessToken(request);
  if (!accessToken) return null;

  const {
    data: { user },
    error,
  } = await getSupabaseAdmin().auth.getUser(accessToken);

  if (error || !user) return null;

  const { data: adminUser } = await getSupabaseAdmin()
    .from("admin_users")
    .select("id, user_id, email, role")
    .eq("user_id", user.id)
    .single();

  if (!adminUser) return null;

  return {
    id: user.id,
    email: user.email!,
    role: adminUser.role,
    adminId: adminUser.id,
  };
}

export async function requireSessionUser(request: Request): Promise<SessionUser> {
  const user = await getSessionUser(request);
  if (!user) {
    throw new Response("Unauthorized", { status: 401 });
  }
  return user;
}

export async function getAdminAuthorId(request: Request): Promise<string | null> {
  const user = await getSessionUser(request);
  return user?.id ?? null;
}

