import { z } from "zod";

export const inquirySource = z.enum(["walkin", "phone", "email", "web", "other"]);
export const inquiryPriority = z.enum(["low", "medium", "high", "urgent"]);
export const inquiryStatus = z.enum(["new", "in_progress", "quoted", "won", "lost", "closed"]);

export const inquiryItemInput = z
  .object({
    productId: z.number().int().positive().nullable().optional(),
    productName: z.string().min(1).max(200),
    qty: z.number().nonnegative().default(1),
    remarks: z.string().max(500).nullable().optional(),
  })
  .strict();
export type InquiryItemInput = z.infer<typeof inquiryItemInput>;

export const inquiryInput = z
  .object({
    customerId: z.number().int().positive().nullable().optional(),
    customerName: z.string().max(200).nullable().optional(),
    source: inquirySource.default("walkin"),
    priority: inquiryPriority.default("medium"),
    requirement: z.string().max(5000).nullable().optional(),
    expectedClosure: z.string().nullable().optional(),
    assignedTo: z.number().int().positive().nullable().optional(),
    items: z.array(inquiryItemInput).default([]),
  })
  .strict()
  .refine((d) => d.customerId || (d.customerName && d.customerName.length > 0), {
    message: "customerId or customerName is required",
    path: ["customerId"],
  });
export type InquiryInput = z.infer<typeof inquiryInput>;
