import { z } from "zod";

export const customerContactInput = z
  .object({
    name: z.string().min(1).max(120),
    designation: z.string().max(120).nullable().optional(),
    email: z
      .string()
      .email()
      .nullable()
      .optional()
      .or(z.literal("").transform(() => null)),
    phone: z.string().max(30).nullable().optional(),
    isPrimary: z.boolean().default(false),
  })
  .strict();
export type CustomerContactInput = z.infer<typeof customerContactInput>;

export const noteEntity = z.enum(["customer", "inquiry", "quotation"]);
export type NoteEntity = z.infer<typeof noteEntity>;

export const noteInput = z
  .object({
    body: z.string().min(1).max(4000),
  })
  .strict();
export type NoteInput = z.infer<typeof noteInput>;
