import { z } from "zod";

export const lockdownStartSchema = z.object({
  allowedApps: z.array(z.string().min(1)),
  allowedUrls: z.array(z.string().min(1)),
  sessionId: z.string().optional(),
  workMinutes: z.number().positive().max(24 * 60).default(30),
  breakMinutes: z.number().nonnegative().max(120).default(5),
  remindersEnabled: z.boolean().default(true),
});

export type LockdownStartPayload = z.infer<typeof lockdownStartSchema>;
