import { describe, it, expect, beforeEach, vi } from "vitest";
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
  const mockInsert = vi.fn().mockReturnThis();
  const mockSelect = vi.fn().mockReturnThis();
  const mockSingle = vi.fn();
  const mockFrom = vi.fn().mockReturnValue({
    insert: mockInsert,
    select: mockSelect,
    single: mockSingle,
  });

  return {
    from: mockFrom,
    mockInsert,
    mockSelect,
    mockSingle,
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
