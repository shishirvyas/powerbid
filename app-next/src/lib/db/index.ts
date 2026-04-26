import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString =
  process.env.BID_DATABASE_URL || process.env.POWERBID_DATABASE_URL || process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("BID_DATABASE_URL (or POWERBID_DATABASE_URL / DATABASE_URL) is not set");
}

// Single shared connection per server instance.
const client = postgres(connectionString, { prepare: false });
export const db = drizzle(client, { schema });
export { schema };
