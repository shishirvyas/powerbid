import { PurchaseOrderBuilder, blankInitial } from "../purchase-order-builder";

export const dynamic = "force-dynamic";

export default function Page() {
  return <PurchaseOrderBuilder initial={blankInitial} mode="create" />;
}
