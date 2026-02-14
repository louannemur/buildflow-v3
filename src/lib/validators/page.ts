import { z } from "zod";

const pageContentSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(200),
  description: z.string().max(1000),
});

export const createPageSchema = z.object({
  title: z.string().min(1, "Page title is required").max(200),
  description: z.string().max(1000).optional(),
});

export type CreatePageInput = z.infer<typeof createPageSchema>;

export const updatePageSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  contents: z.array(pageContentSchema).optional(),
});

export type UpdatePageInput = z.infer<typeof updatePageSchema>;

export const reorderPagesSchema = z.object({
  pageIds: z.array(z.string().uuid()).min(1),
});

export type ReorderPagesInput = z.infer<typeof reorderPagesSchema>;
