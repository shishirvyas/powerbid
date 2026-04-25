import { z } from "zod";

export const productInput = z
  .object({
    sku: z.string().min(1).max(80),
    name: z.string().min(1).max(200),
    description: z.string().max(2000).nullable().optional(),
    brandId: z.number().int().positive().nullable().optional(),
    unitId: z.number().int().positive().nullable().optional(),
    gstSlabId: z.number().int().positive().nullable().optional(),
    basePrice: z.number().min(0).default(0),
  })
  .strict();
export type ProductInput = z.infer<typeof productInput>;

export const productListQuery = z
  .object({
    q: z.string().optional(),
    brandId: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().min(1).max(200).default(50),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .strict();
export type ProductListQuery = z.infer<typeof productListQuery>;
