import { z } from "zod";

const flowStepSchema = z.object({
  id: z.string(),
  title: z.string().min(1).max(200),
  description: z.string().max(1000),
  type: z.enum(["action", "decision", "navigation", "input", "display"]),
});

export const createFlowSchema = z.object({
  title: z.string().min(1, "Flow title is required").max(200),
  steps: z.array(flowStepSchema).min(1, "At least one step is required"),
});

export type CreateFlowInput = z.infer<typeof createFlowSchema>;

export const updateFlowSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  steps: z.array(flowStepSchema).optional(),
});

export type UpdateFlowInput = z.infer<typeof updateFlowSchema>;
