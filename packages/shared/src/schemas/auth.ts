import { z } from "zod";

export const loginInput = z
  .object({ email: z.string().email(), password: z.string().min(6) })
  .strict();
export type LoginInput = z.infer<typeof loginInput>;

export const registerInput = loginInput.extend({ name: z.string().min(2).max(120) }).strict();
export type RegisterInput = z.infer<typeof registerInput>;
