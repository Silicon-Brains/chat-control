import { z } from 'zod';

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{3,24}$/, 'Use 3–24 lowercase letters, numbers or underscores');

export const userLoginSchema = z.object({
  username: usernameSchema,
  code: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[0-9a-f]{10}$/, 'Your code is 10 characters (0–9, a–f)'),
});

export const adminLoginSchema = z.object({
  username: usernameSchema,
  adminCode: z.string().min(24, 'Admin code is at least 24 characters'),
  totp: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit authenticator code'),
});

export const createUserSchema = z.object({
  username: usernameSchema,
  displayName: z.string().trim().min(1, 'Enter a display name').max(60),
});

export const groupSchema = z.object({
  name: z.string().trim().min(2, 'Name your group').max(60),
  memberIds: z.array(z.string()).min(1, 'Pick at least one member').max(199),
});

export type FieldErrors<T> = Partial<Record<keyof T, string>>;

export function fieldErrors<T>(error: z.ZodError<T>): FieldErrors<T> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? '');
    if (!(key in out)) out[key] = issue.message;
  }
  return out as FieldErrors<T>;
}
