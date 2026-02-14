import { z } from "zod";

export const updatePreferencesSchema = z.object({
  theme: z.enum(["system", "light", "dark"]).optional(),
  language: z.enum(["en"]).optional(),
  highContrast: z.boolean().optional(),
  largeText: z.boolean().optional(),
  reduceAnimations: z.boolean().optional(),
  emailNotifications: z.boolean().optional(),
});

export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>;
