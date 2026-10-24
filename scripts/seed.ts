import { createDb } from "../db/client";
import { seedDatabase } from "../db/seed";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is required to seed a database.");
    process.exit(1);
  }
  const result = await seedDatabase(createDb(url));
  console.log("[seed] done", result);
}

main().catch((e) => {
  console.error("[seed] failed:", e);
  process.exit(1);
});
