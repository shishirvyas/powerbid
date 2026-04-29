import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { PurchaseOrderBuilder, type POBuilderInitial } from "../../purchase-order-builder";
import { db } from "@/lib/db";
import { parseId, requireSession } from "@/lib/api";
import { purchaseOrderItems, purchaseOrders } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requireSession();
  const id = parseId((await params).id);

  const [po] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, id));
  if (!po) notFound();

  const items = await db
    .select()
    .from(purchaseOrderItems)
    .where(eq(purchaseOrderItems.poId, id))
    .orderBy(purchaseOrderItems.sortOrder);

  const initial: POBuilderInitial = {
    id: po.id,
    supplierId: po.supplierId,
    expectedDate: po.expectedDate || "",
    status: po.status as POBuilderInitial["status"],
    currency: po.currency,
    discountType: po.discountType as POBuilderInitial["discountType"],
    discountValue: Number(po.discountValue),
    freightAmount: Number(po.freightAmount),
    remarks: po.remarks || "",
    termsConditions: po.termsConditions || "",
    paymentTerms: po.paymentTerms || "",
    items: items.map((it) => ({
      productId: String(it.productId || ""),
      productQuery: it.productName,
      productName: it.productName,
      unitName: it.unitName || "",
      qty: String(it.qty),
      unitPrice: String(it.unitPrice),
      discountPercent: String(it.discountPercent),
      gstSlabId: String(it.gstSlabId || ""),
      gstRate: String(it.gstRate),
    })),
  };

  if (initial.items.length === 0) {
    initial.items.push({
      productId: "",
      productQuery: "",
      productName: "",
      unitName: "",
      qty: "1",
      unitPrice: "0",
      discountPercent: "0",
      gstSlabId: "",
      gstRate: "0",
    });
  }

  return <PurchaseOrderBuilder initial={initial} mode="edit" />;
}
