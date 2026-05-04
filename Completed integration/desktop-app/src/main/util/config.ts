import { z } from "zod";

export const lockdownStartSchema = z
  .object({
    allowedApps: z.array(z.string().min(1)),
    allowedUrls: z.array(z.string().min(1)),
    /** When true, HTTPS (CONNECT) is only allowed to listed hosts (+ localhost). When false, web is not URL-filtered. */
    restrictWebsites: z.boolean().default(true),
    sessionId: z.string().optional(),
    workMinutes: z.number().positive().max(24 * 60).default(30),
    breakMinutes: z.number().nonnegative().max(120).default(5),
    remindersEnabled: z.boolean().default(true),
  })
  .superRefine((data, ctx) => {
    if (data.restrictWebsites && data.allowedUrls.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "allowedUrls: add at least one allowed hostname when website restriction is enabled, or disable website restriction.",
        path: ["allowedUrls"],
      });
    }
  });

export type LockdownStartPayload = z.infer<typeof lockdownStartSchema>;
