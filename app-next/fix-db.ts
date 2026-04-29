import { db } from "./src/lib/db";
import { subjectTemplates } from "./src/lib/db/schema";

async function main() {
  await db.delete(subjectTemplates);
  console.log("Deleted subject templates!");
  process.exit(0);
}
main().catch(console.error);
