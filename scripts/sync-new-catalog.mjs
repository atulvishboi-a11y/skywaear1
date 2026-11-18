import "dotenv/config";
import { PRODUCTS } from "../src/data/products.js";
import { ensureStateLoaded, mutate, readState } from "../src/lib/server/store.js";
import { persistStateToPostgres } from "../src/lib/server/db.js";
import fs from "fs";
import path from "path";

async function main() {
  console.log("=== Synchronizing Database with New Mockups Catalog ===");

  await ensureStateLoaded();

  await mutate((state) => {
    console.log(`Current products in state before update: ${state.products.length}`);

    // Replace products with the 3 new authentic mockups
    state.products = PRODUCTS.map((p) => ({
      ...p,
      stock: p.stock ?? 60,
      isArchived: false,
    }));

    state.revision = (state.revision ?? 0) + 1;
    console.log(`Updated state.products to ${state.products.length} products:`);
    for (const p of state.products) {
      console.log(`  - [${p.id}] ${p.title} (${p.imageUrl})`);
    }
  });

  const finalState = readState();
  console.log(`\nVerified final state products count: ${finalState.products.length}`);

  // Also write to local .data/zenin-state.json
  const dataDir = path.join(process.cwd(), ".data");
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, "zenin-state.json"), JSON.stringify(finalState, null, 2), "utf8");

  console.log("✓ Catalog updated and persisted successfully to disk and PostgreSQL!");
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
