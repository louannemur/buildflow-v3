import { z } from "zod";

export const createFeatureSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(1000).default(""),
});

export type CreateFeatureInput = z.infer<typeof createFeatureSchema>;

export const updateFeatureSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(1).max(1000).optional(),
});

export type UpdateFeatureInput = z.infer<typeof updateFeatureSchema>;

export const reorderFeaturesSchema = z.object({
  featureIds: z.array(z.string().uuid()).min(1),
});

export type ReorderFeaturesInput = z.infer<typeof reorderFeaturesSchema>;
