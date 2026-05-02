import { SupplierProductsClient } from "./supplier-products-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Supplier Products" };

export default function Page() {
  return <SupplierProductsClient />;
}
