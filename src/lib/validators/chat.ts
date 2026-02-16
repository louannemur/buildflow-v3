import { z } from "zod";

export const classifyMessageSchema = z.object({
  message: z.string().min(1, "Message is required").max(500),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      }),
    )
    .optional(),
});

export type ClassifyMessageInput = z.infer<typeof classifyMessageSchema>;
