import { z } from "zod";

export const classifyMessageSchema = z.object({
  message: z.string().min(1, "Message is required").max(500),
});

export type ClassifyMessageInput = z.infer<typeof classifyMessageSchema>;
