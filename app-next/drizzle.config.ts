import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.BID_DATABASE_URL ||
      process.env.POWERBID_DATABASE_URL ||
      process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});
