import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { SaveLeadSkill, createSaveLeadSkill } from "../skills/save-lead";
import { SkillContext, ToolPermission } from "../skills/types";
import { auditLogger } from "../security/audit-log";

vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: vi.fn() }));
vi.mock("../security/audit-log", () => ({
  auditLogger: {
    logSecurityEvent: vi.fn().mockResolvedValue(undefined),
    logToolExecutionFailure: vi.fn().mockResolvedValue(undefined),
  },
}));

import { getSupabaseAdmin } from "@/lib/supabase/admin";

function createMockSkillContext(overrides: Partial<SkillContext> = {}): SkillContext {
  return {
    conversationId: "conv-1",
    sessionId: "session-1",
    userId: undefined,
    locale: "fr",
    requestId: "req-1",
    ...overrides,
  };
}

function createMockSupabaseAdmin() {
  const mockSingle = vi.fn();
  const mockMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });

  // One chainable builder shared by both paths of execute():
  //   dedup : from().select().eq().gte().or().limit().maybeSingle()
  //   insert: from().insert().select().single()
  const chain = {} as Record<string, unknown>;
  chain.select = vi.fn().mockReturnThis();
  chain.eq = vi.fn().mockReturnThis();
  chain.gte = vi.fn().mockReturnThis();
  chain.or = vi.fn().mockReturnThis();
  chain.limit = vi.fn().mockReturnThis();
  chain.insert = vi.fn().mockReturnThis();
  chain.single = mockSingle;
  chain.maybeSingle = mockMaybeSingle;

  const mockFrom = vi.fn().mockReturnValue(chain);

  return {
    from: mockFrom,
    mockInsert: chain.insert as ReturnType<typeof vi.fn>,
    mockSelect: chain.select as ReturnType<typeof vi.fn>,
    mockEq: chain.eq as ReturnType<typeof vi.fn>,
    mockGte: chain.gte as ReturnType<typeof vi.fn>,
    mockOr: chain.or as ReturnType<typeof vi.fn>,
    mockLimit: chain.limit as ReturnType<typeof vi.fn>,
    mockSingle,
    mockMaybeSingle,
    mockFrom,
  };
}

describe("SaveLeadSkill", () => {
  let skill: SaveLeadSkill;
  let mockSupabase: ReturnType<typeof createMockSupabaseAdmin>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createMockSupabaseAdmin();
    vi.mocked(getSupabaseAdmin).mockReturnValue(
      mockSupabase as unknown as ReturnType<typeof getSupabaseAdmin>,
    );

    skill = createSaveLeadSkill(() => getSupabaseAdmin());
  });

  it("has correct metadata", () => {
    expect(skill.name).toBe("save_lead");
    expect(skill.permissions).toEqual(["public"]);
    expect(skill.metadata?.category).toBe("lead-capture");
  });

  it("validates required first_name and summary", () => {
    expect(() => skill.validate({})).toThrow();
    expect(() => skill.validate({ first_name: "Jean" })).toThrow();
    expect(() => skill.validate({ summary: "Valid summary" })).toThrow();
    expect(() =>
      skill.validate({
        first_name: "Jean",
        email: "jean@example.com",
        summary: "Valid summary of conversation",
      }),
    ).not.toThrow();
  });

  it("validates first_name length", () => {
    expect(() =>
      skill.validate({ first_name: "", email: "a@b.c", summary: "Valid summary" }),
    ).toThrow();
    expect(() =>
      skill.validate({ first_name: "a".repeat(101), email: "a@b.c", summary: "Valid summary" }),
    ).toThrow();
    expect(() =>
      skill.validate({ first_name: "Jean", email: "jean@example.com", summary: "Valid summary" }),
    ).not.toThrow();
  });

  it("validates summary length", () => {
    expect(() =>
      skill.validate({ first_name: "Jean", email: "a@b.c", summary: "Short" }),
    ).toThrow();
    expect(() =>
      skill.validate({ first_name: "Jean", email: "a@b.c", summary: "a".repeat(2001) }),
    ).toThrow();
    expect(() =>
      skill.validate({
        first_name: "Jean",
        email: "jean@example.com",
        summary: "Valid summary of conversation",
      }),
    ).not.toThrow();
  });

  it("validates email format when provided", () => {
    expect(() =>
      skill.validate({
        first_name: "Jean",
        email: "invalid-email",
        summary: "Valid summary",
      }),
    ).toThrow();
    expect(() =>
      skill.validate({
        first_name: "Jean",
        email: "jean@example.com",
        summary: "Valid summary",
      }),
    ).not.toThrow();
  });

  it("validates phone length when provided", () => {
    expect(() =>
      skill.validate({
        first_name: "Jean",
        phone: "123",
        summary: "Valid summary",
      }),
    ).toThrow();
    expect(() =>
      skill.validate({
        first_name: "Jean",
        phone: "0123456789",
        summary: "Valid summary",
      }),
    ).not.toThrow();
  });

  it("requires at least email OR phone", () => {
    expect(() =>
      skill.validate({
        first_name: "Jean",
        summary: "Valid summary",
      }),
    ).toThrow();
    expect(() =>
      skill.validate({
        first_name: "Jean",
        email: "jean@example.com",
        summary: "Valid summary",
      }),
    ).not.toThrow();
    expect(() =>
      skill.validate({
        first_name: "Jean",
        phone: "0123456789",
        summary: "Valid summary",
      }),
    ).not.toThrow();
    expect(() =>
      skill.validate({
        first_name: "Jean",
        email: "jean@example.com",
        phone: "0123456789",
        summary: "Valid summary",
      }),
    ).not.toThrow();
  });

  it("rejects unknown fields (strict schema)", () => {
    expect(() =>
      skill.validate({
        first_name: "Jean",
        email: "jean@example.com",
        summary: "Valid summary",
        unknown_field: "should fail",
      }),
    ).toThrow();
  });

  it("inserts lead with session_id, conversation_id, and validated data", async () => {
    const mockLead = {
      id: "lead-123",
      created_at: "2026-10-01T00:00:00Z",
    };
    mockSupabase.mockSingle.mockResolvedValue({ data: mockLead, error: null });

    const context = createMockSkillContext({
      sessionId: "session-abc",
      conversationId: "conv-abc",
    });
    const result = await skill.execute(context, {
      first_name: "Jean",
      email: "jean@example.com",
      phone: null,
      summary: "Visitor wants a quote for a React project with 5 pages.",
    });

    expect(result.success).toBe(true);
    expect(result.data?.leadId).toBe("lead-123");
    expect(result.data?.createdAt).toBe("2026-10-01T00:00:00Z");

    expect(mockSupabase.mockFrom).toHaveBeenCalledWith("leads");
    expect(mockSupabase.mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        session_id: "session-abc",
        conversation_id: "conv-abc",
        first_name: "Jean",
        email: "jean@example.com",
        phone: null,
        summary: "Visitor wants a quote for a React project with 5 pages.",
        metadata: {},
      }),
    );
  });

  it("inserts lead with phone only (no email)", async () => {
    const mockLead = { id: "lead-456", created_at: "2026-10-01T00:00:00Z" };
    mockSupabase.mockSingle.mockResolvedValue({ data: mockLead, error: null });

    const context = createMockSkillContext();
    const result = await skill.execute(context, {
      first_name: "Marie",
      email: null,
      phone: "0123456789",
      summary: "Visitor needs SEO audit for e-commerce site.",
    });

    expect(result.success).toBe(true);
    expect(mockSupabase.mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        email: null,
        phone: "0123456789",
      }),
    );
  });

  it("emits lead_created audit event on success", async () => {
    const mockLead = { id: "lead-789", created_at: "2026-10-01T00:00:00Z" };
    mockSupabase.mockSingle.mockResolvedValue({ data: mockLead, error: null });

    const context = createMockSkillContext({ userId: "user-123" });
    await skill.execute(context, {
      first_name: "Pierre",
      email: "pierre@example.com",
      summary: "Visitor interested in website redesign.",
    });

    expect(auditLogger.logSecurityEvent).toHaveBeenCalledWith(
      "lead_created",
      expect.objectContaining({
        severity: "low",
        userId: "user-123",
        sessionId: "session-1",
        conversationId: "conv-1",
        requestId: "req-1",
        eventData: expect.objectContaining({
          leadId: "lead-789",
          firstName: "Pierre",
          hasEmail: true,
          hasPhone: false,
        }),
      }),
    );
  });

  it("returns failure result on Supabase insert error", async () => {
    mockSupabase.mockSingle.mockResolvedValue({
      data: null,
      error: { message: "Database error: duplicate key" },
    });

    const context = createMockSkillContext();
    const result = await skill.execute(context, {
      first_name: "Jean",
      email: "jean@example.com",
      summary: "Valid summary",
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("EXECUTION_FAILED");
    expect(result.error?.recoverable).toBe(true);
    expect(auditLogger.logToolExecutionFailure).toHaveBeenCalled();
  });

  it("handles unexpected errors gracefully", async () => {
    mockSupabase.mockFrom.mockImplementation(() => {
      throw new Error("Unexpected error");
    });

    const context = createMockSkillContext();
    const result = await skill.execute(context, {
      first_name: "Jean",
      email: "jean@example.com",
      summary: "Valid summary",
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("EXECUTION_FAILED");
    expect(auditLogger.logToolExecutionFailure).toHaveBeenCalled();
  });
});

describe("SaveLeadSkill deduplication (LOT 38a quinquies)", () => {
  let skill: SaveLeadSkill;
  let mockSupabase: ReturnType<typeof createMockSupabaseAdmin>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createMockSupabaseAdmin();
    vi.mocked(getSupabaseAdmin).mockReturnValue(
      mockSupabase as unknown as ReturnType<typeof getSupabaseAdmin>,
    );

    skill = createSaveLeadSkill(() => getSupabaseAdmin());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("dedupes a lead with same email+session within 24h", async () => {
    mockSupabase.mockMaybeSingle.mockResolvedValue({
      data: { id: "lead-existing", created_at: "2026-10-05T10:00:00Z" },
      error: null,
    });

    const context = createMockSkillContext({ sessionId: "session-1" });
    const result = await skill.execute(context, {
      first_name: "Marie",
      email: "marie@example.com",
      summary: "Visitor re-sends the same coordinates in the same session.",
    });

    expect(result.success).toBe(true);
    expect(result.data?.leadId).toBe("lead-existing");
    expect(result.data?.createdAt).toBe("2026-10-05T10:00:00Z");
    expect(result.data?.deduplicated).toBe(true);

    expect(mockSupabase.mockEq).toHaveBeenCalledWith("session_id", "session-1");
    expect(mockSupabase.mockOr).toHaveBeenCalledWith("email.eq.marie@example.com");
    expect(mockSupabase.mockMaybeSingle).toHaveBeenCalled();

    expect(mockSupabase.mockInsert).not.toHaveBeenCalled();
    expect(auditLogger.logSecurityEvent).not.toHaveBeenCalledWith(
      "lead_created",
      expect.anything(),
    );
  });

  it("dedupes a lead with same phone+session within 24h", async () => {
    mockSupabase.mockMaybeSingle.mockResolvedValue({
      data: { id: "lead-existing-phone", created_at: "2026-10-05T09:00:00Z" },
      error: null,
    });

    const context = createMockSkillContext({ sessionId: "session-phone" });
    const result = await skill.execute(context, {
      first_name: "Marie",
      phone: "0123456789",
      summary: "Visitor re-sends the same phone number in the same session.",
    });

    expect(result.success).toBe(true);
    expect(result.data?.leadId).toBe("lead-existing-phone");
    expect(result.data?.deduplicated).toBe(true);

    expect(mockSupabase.mockOr).toHaveBeenCalledWith("phone.eq.0123456789");
    expect(mockSupabase.mockInsert).not.toHaveBeenCalled();
  });

  it("creates a new lead when email differs", async () => {
    // Dedup query returns no row (different email => no match in DB).
    mockSupabase.mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockSupabase.mockSingle.mockResolvedValue({
      data: { id: "lead-new", created_at: "2026-10-05T11:00:00Z" },
      error: null,
    });

    const context = createMockSkillContext({ sessionId: "session-1" });
    const result = await skill.execute(context, {
      first_name: "Jean",
      email: "jean.other@example.com",
      summary: "Different email in the same session must create a new lead.",
    });

    expect(result.success).toBe(true);
    expect(result.data?.leadId).toBe("lead-new");
    expect(result.data?.deduplicated).toBeUndefined();
    expect(mockSupabase.mockOr).toHaveBeenCalledWith("email.eq.jean.other@example.com");
    expect(mockSupabase.mockInsert).toHaveBeenCalled();
    expect(auditLogger.logSecurityEvent).toHaveBeenCalledWith("lead_created", expect.anything());
  });

  it("creates a new lead when session differs", async () => {
    // Dedup query is scoped by session_id => another session never matches.
    mockSupabase.mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockSupabase.mockSingle.mockResolvedValue({
      data: { id: "lead-other-session", created_at: "2026-10-05T11:00:00Z" },
      error: null,
    });

    const context = createMockSkillContext({ sessionId: "session-other" });
    const result = await skill.execute(context, {
      first_name: "Marie",
      email: "marie@example.com",
      summary: "Same coordinates but a different session must create a new lead.",
    });

    expect(result.success).toBe(true);
    expect(result.data?.leadId).toBe("lead-other-session");
    expect(mockSupabase.mockEq).toHaveBeenCalledWith("session_id", "session-other");
    expect(mockSupabase.mockInsert).toHaveBeenCalled();
  });

  it("creates a new lead after 24h window (dedup expired)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-05T12:00:00.000Z"));

    // No row within the last 24h => insert proceeds.
    mockSupabase.mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockSupabase.mockSingle.mockResolvedValue({
      data: { id: "lead-later", created_at: "2026-10-05T12:00:00Z" },
      error: null,
    });

    const context = createMockSkillContext({ sessionId: "session-1" });
    const result = await skill.execute(context, {
      first_name: "Marie",
      email: "marie@example.com",
      summary: "Coordinates sent more than 24h ago must not deduplicate.",
    });

    expect(result.success).toBe(true);
    expect(mockSupabase.mockGte).toHaveBeenCalledWith("created_at", "2026-10-04T12:00:00.000Z");
    expect(result.data?.leadId).toBe("lead-later");
    expect(mockSupabase.mockInsert).toHaveBeenCalled();
  });
});
