import { QuotationBuilderForId } from "../../quotation-builder";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export default async function Page({ params }: Ctx) {
  const { id } = await params;
  return <QuotationBuilderForId id={Number(id)} />;
}
