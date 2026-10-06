import { createServerFn } from "@tanstack/react-start";
import { adminMiddleware } from "@/lib/auth/middleware";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";
import { z } from "zod";

const ListLeadsSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
});

const DeleteLeadSchema = z.object({
  id: z.string().uuid(),
});

export type ListLeadsInput = z.infer<typeof ListLeadsSchema>;
export type DeleteLeadInput = z.infer<typeof DeleteLeadSchema>;

export type LeadRow = {
  id: string;
  session_id: string;
  conversation_id: string | null;
  first_name: string;
  email: string | null;
  phone: string | null;
  summary: string;
  metadata: Json;
  created_at: string;
};

async function assertAdmin(): Promise<void> {
  const admin = getSupabaseAdmin();
  const { data: user, error } = await admin.auth.getUser();
  if (error || !user.user) {
    throw new Response("Unauthorized", { status: 401 });
  }
  const { data: adminUser, error: adminError } = await admin
    .from("admin_users")
    .select("id")
    .eq("user_id", user.user.id)
    .maybeSingle();
  if (adminError || !adminUser) {
    throw new Response("Forbidden: Admin access required", { status: 403 });
  }
}

export async function handleListLeads(data: ListLeadsInput) {
  await assertAdmin();
  const supabase = getSupabaseAdmin();

  const page = data.page ?? 1;
  const limit = data.limit ?? 20;
  const offset = (page - 1) * limit;

  const {
    data: leads,
    error,
    count,
  } = await supabase
    .from("leads")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw new Error(error.message);

  return {
    data: (leads ?? []) as LeadRow[],
    total: count ?? 0,
    page,
    limit,
    totalPages: Math.ceil((count ?? 0) / limit),
  };
}

export async function handleDeleteLead(data: DeleteLeadInput): Promise<{ success: true }> {
  await assertAdmin();
  const supabase = getSupabaseAdmin();

  const { error } = await supabase.from("leads").delete().eq("id", data.id);

  if (error) throw new Error(error.message);

  return { success: true };
}

export const listLeads = createServerFn({ method: "GET" })
  .middleware([adminMiddleware])
  .validator((data: unknown) => ListLeadsSchema.parse(data))
  .handler(({ data }) => handleListLeads(data));

export const deleteLead = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator((data: unknown) => DeleteLeadSchema.parse(data))
  .handler(({ data }) => handleDeleteLead(data));
