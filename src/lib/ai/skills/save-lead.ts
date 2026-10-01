import { z } from "zod";
import {
  Skill,
  SkillContext,
  SkillResult,
  SkillInput,
  SkillOutput,
  ToolDefinition,
  ToolPermission,
} from "./types";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";
import { auditLogger } from "../security/audit-log";

export interface SaveLeadInput extends SkillInput {
  first_name: string;
  email?: string | null;
  phone?: string | null;
  summary: string;
}

export interface SaveLeadOutput extends SkillOutput {
  leadId: string;
  createdAt: string;
}

export class SaveLeadSkill implements Skill<SaveLeadInput, SaveLeadOutput> {
  readonly name = "save_lead";
  readonly description =
    "Save a visitor lead with their contact details and conversation summary. Call this when a visitor voluntarily provides their first name and at least one contact method (email or phone) and agrees to be contacted.";
  readonly permissions: ToolPermission[] = ["public"];

  readonly schema = {
    type: "object",
    properties: {
      first_name: {
        type: "string",
        description: "Visitor's first name (required)",
        minLength: 1,
        maxLength: 100,
      },
      email: {
        type: "string",
        description: "Visitor's email address (optional if phone provided)",
        format: "email",
        maxLength: 254,
      },
      phone: {
        type: "string",
        description: "Visitor's phone number (optional if email provided)",
        minLength: 5,
        maxLength: 30,
      },
      summary: {
        type: "string",
        description: "Brief summary of the conversation (3-5 lines, in visitor's language)",
        minLength: 10,
        maxLength: 2000,
      },
    },
    required: ["first_name", "summary"],
  } as const;

  readonly metadata = {
    category: "lead-capture",
    tags: ["lead", "crm", "visitor"],
    version: "1.0.0",
    description: "Capture visitor lead via tool call during chat conversation",
  };

  private getAdminClient: () => ReturnType<typeof getSupabaseAdmin>;

  constructor(getAdminClient: () => ReturnType<typeof getSupabaseAdmin>) {
    this.getAdminClient = getAdminClient;
  }

  toToolDefinition(): ToolDefinition {
    return {
      type: "function",
      function: {
        name: this.name,
        description: this.description,
        parameters: this.schema,
      },
    };
  }

  validate(input: unknown): SaveLeadInput {
    const baseSchema = z
      .object({
        first_name: z.string().min(1).max(100),
        email: z.string().email().max(254).nullable().optional(),
        phone: z.string().min(5).max(30).nullable().optional(),
        summary: z.string().min(10).max(2000),
      })
      .strict();

    const schema = baseSchema.refine((data) => data.email || data.phone, {
      message: "At least one of email or phone is required",
      path: ["email"],
    });
    return schema.parse(input);
  }

  async execute(
    context: SkillContext,
    options: SaveLeadInput,
  ): Promise<SkillResult<SaveLeadOutput>> {
    try {
      const supabase = this.getAdminClient();

      const insertData = {
        session_id: context.sessionId,
        conversation_id: context.conversationId,
        first_name: options.first_name,
        email: options.email ?? null,
        phone: options.phone ?? null,
        summary: options.summary,
        metadata: {} as Json,
      };

      const { data: lead, error } = await supabase
        .from("leads")
        .insert(insertData)
        .select("id, created_at")
        .single();

      if (error) {
        throw new Error(error.message);
      }

      // Emit lead.created event to audit log
      await auditLogger.logSecurityEvent("lead_created", {
        severity: "low",
        userId: context.userId,
        sessionId: context.sessionId,
        conversationId: context.conversationId,
        requestId: context.requestId,
        eventData: {
          leadId: lead.id,
          firstName: options.first_name,
          hasEmail: !!options.email,
          hasPhone: !!options.phone,
        },
      });

      return {
        success: true,
        data: {
          leadId: lead.id,
          createdAt: lead.created_at,
        },
        followUp:
          "Lead saved successfully. Confirm to the visitor that their details have been recorded.",
      };
    } catch (error) {
      await auditLogger.logToolExecutionFailure(
        this.name,
        error instanceof Error ? error.message : "Unknown error",
        {
          userId: context.userId,
          sessionId: context.sessionId,
          conversationId: context.conversationId,
          requestId: context.requestId,
        },
      );

      return {
        success: false,
        error: {
          code: "EXECUTION_FAILED",
          message: error instanceof Error ? error.message : "Failed to save lead",
          recoverable: true,
        },
      };
    }
  }
}

export function createSaveLeadSkill(
  getAdminClient: () => ReturnType<typeof getSupabaseAdmin>,
): SaveLeadSkill {
  return new SaveLeadSkill(getAdminClient);
}
