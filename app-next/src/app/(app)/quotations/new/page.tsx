import { QuotationBuilder, blankInitial } from "../quotation-builder";

export const dynamic = "force-dynamic";

export default function Page() {
  return <QuotationBuilder mode="create" initial={blankInitial} />;
}
