import { z } from "zod";

export const createDesignSchema = z.object({
  name: z.string().min(1, "Design name is required").max(100),
});

export type CreateDesignInput = z.infer<typeof createDesignSchema>;

export const updateDesignSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  html: z.string().optional(),
  fonts: z
    .object({
      heading: z.string(),
      body: z.string(),
    })
    .nullable()
    .optional(),
  colors: z
    .object({
      primary: z.string(),
      secondary: z.string(),
      accent: z.string(),
      background: z.string(),
      text: z.string(),
    })
    .nullable()
    .optional(),
  isStyleGuide: z.boolean().optional(),
});

export type UpdateDesignInput = z.infer<typeof updateDesignSchema>;
