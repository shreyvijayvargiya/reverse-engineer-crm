import { z } from "zod/v4";
import { ACCENTS, FIELD_TYPES } from "./schema.js";

// zod/v4 on purpose: the Anthropic SDK's structured-output helper takes v4 schemas.

/** Brief: the small structure the planner (Claude or offline) returns. Flat and regex-free so it works as a structured-output schema. */

export function makeBriefSchema(moduleIds: readonly string[], toolIds: readonly string[]) {
  const moduleEnum = z.enum(moduleIds as [string, ...string[]]);
  const toolEnum = z.enum(toolIds as [string, ...string[]]);
  return z.object({
    name: z.string().describe("Short product name for this CRM, e.g. 'BrightSmile Clinic CRM'"),
    description: z.string().describe("One sentence describing who uses it and for what"),
    vertical: z.string().describe("The business type in a few words, e.g. 'dental clinic'"),
    accent: z.enum(ACCENTS),
    modules: z
      .array(
        z.object({
          id: moduleEnum,
          label: z.string().describe("Plural nav label in the user's vocabulary, e.g. 'Patients'"),
          singular: z.string().describe("Singular form, e.g. 'Patient'"),
        }),
      )
      .describe("Catalog modules to include. Keep it minimal: only what the workflow needs."),
    extraFields: z
      .array(
        z.object({
          module: moduleEnum,
          key: z.string().describe("camelCase key"),
          label: z.string(),
          type: z.enum(FIELD_TYPES),
          options: z.array(z.string()).describe("Options for select/status, otherwise an empty array"),
        }),
      )
      .describe("Extra fields on a module's primary entity that the vertical needs (e.g. insurance on patients)"),
    customEntities: z
      .array(
        z.object({
          key: z.string().describe("camelCase key"),
          label: z.string(),
          plural: z.string(),
          fields: z.array(
            z.object({
              key: z.string(),
              label: z.string(),
              type: z.enum(FIELD_TYPES),
              options: z.array(z.string()),
            }),
          ),
        }),
      )
      .describe("Only when no catalog module fits part of the workflow. Usually empty."),
    tools: z.array(toolEnum).describe("Third-party tools the workflow implies, from the registry only"),
    clarifyingQuestions: z
      .array(z.string())
      .describe("At most 3 questions, only if the description is too vague to pick modules. Usually empty."),
    rationale: z.string().describe("2-3 sentences: why these modules and tools"),
  });
}
export type Brief = z.infer<ReturnType<typeof makeBriefSchema>>;
