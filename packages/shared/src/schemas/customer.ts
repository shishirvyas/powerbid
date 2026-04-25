import { z } from "zod";

export const customerInput = z
  .object({
    code: z.string().min(1).max(50),
    name: z.string().min(1).max(200),
    contactPerson: z.string().max(120).nullable().optional(),
    email: z.string().email().nullable().optional().or(z.literal("").transform(() => null)),
    phone: z.string().max(30).nullable().optional(),
    gstin: z.string().regex(/^[0-9A-Z]{15}$/i, "GSTIN must be 15 chars").nullable().optional()
      .or(z.literal("").transform(() => null)),
    addressLine1: z.string().max(200).nullable().optional(),
    addressLine2: z.string().max(200).nullable().optional(),
    city: z.string().max(80).nullable().optional(),
    state: z.string().max(80).nullable().optional(),
    pincode: z.string().max(15).nullable().optional(),
  })
  .strict();
export type CustomerInput = z.infer<typeof customerInput>;

export const customerListQuery = z
  .object({
    q: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(200).default(50),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .strict();
export type CustomerListQuery = z.infer<typeof customerListQuery>;
