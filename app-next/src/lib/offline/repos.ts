/**
 * Concrete repositories for the three pilot entities.
 * Components import these directly.
 */

import { createRepo } from './base-repo';
import type {
  InquiryRecord,
  QuotationRecord,
  SalesOrderRecord,
} from './types';

export const inquiriesRepo  = createRepo<InquiryRecord>('inquiries');
export const quotationsRepo = createRepo<QuotationRecord>('quotations');
export const salesOrdersRepo = createRepo<SalesOrderRecord>('salesOrders');
