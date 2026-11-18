import { createProduct, updateProduct, storefrontSnapshot, adminOverview } from "../src/lib/server/services.js";
import { readState, ensureStateLoaded } from "../src/lib/server/store.js";

async function main() {
  console.log("=== Testing Product Creation, Editing & Retention ===");

  await ensureStateLoaded();
  const initialProductsCount = readState().products.length;
  console.log(`Initial products in state: ${initialProductsCount}`);

  // 1. Create test t-shirt
  const testTitle = `TEST HEAVYWEIGHT TEE ${Date.now().toString(36).toUpperCase()}`;
  console.log(`Creating product: "${testTitle}"...`);

  const created = await createProduct(
    {
      title: testTitle,
      subtitle: "240 GSM Luxury Heavyweight Boxy Tee",
      description: "Custom drop created by admin",
      category: "T-Shirts",
      price: 1199,
      mrp: 1899,
      stock: 45,
      showOnStorefront: true,
      showInAnime: true,
      showInNewDrops: true,
      theme: "Heavyweight Core",
    },
    "Admin"
  );

  console.log(`✓ Product created with ID: ${created.id}, SKU: ${created.sku}`);

  // 2. Edit the newly created product
  console.log(`Editing newly created product ${created.id}...`);
  const updatedNew = await updateProduct(
    created.id,
    {
      title: `${testTitle} (UPDATED)`,
      price: 1399,
      mrp: 2199,
      stock: 99,
      artworkUrl: "/products/art-sample.webp",
    },
    "Admin"
  );
  if (updatedNew.title !== `${testTitle} (UPDATED)` || updatedNew.price !== 1399) {
    throw new Error("FAILED: Product edit did not take effect on the created product!");
  }
  console.log(`✓ Product edit succeeded: title="${updatedNew.title}", price=${updatedNew.price}`);

  // 3. Edit an existing seed product (from catalog)
  const seedProduct = readState().products.find((p) => p.id === "zenin-10367431180345" || p.id === "zenin-7784287961145");
  if (seedProduct) {
    console.log(`Editing existing seed product: ${seedProduct.id} ("${seedProduct.title}")...`);
    const origPrice = seedProduct.price;
    const newPrice = origPrice + 100;
    const updatedSeed = await updateProduct(
      seedProduct.id,
      {
        price: newPrice,
        mrp: newPrice + 500,
        stock: 77,
      },
      "Admin"
    );
    if (updatedSeed.price !== newPrice) {
      throw new Error(`FAILED: Seed product edit did not update price! Expected ${newPrice}, got ${updatedSeed.price}`);
    }
    console.log(`✓ Seed product edited successfully: price was ${origPrice}, now ${updatedSeed.price}`);

    // 4. Simulate cold-starts and check persistence across multiple loads
    console.log("Simulating server cold starts / repeated requests...");
    await ensureStateLoaded();
    const stateAfterReload = readState();

    const checkedSeed = stateAfterReload.products.find((p) => p.id === seedProduct.id);
    if (!checkedSeed || checkedSeed.price !== newPrice) {
      throw new Error(`FAILED: Seed product REVERTED back to old value after reload! Got price ${checkedSeed?.price}, expected ${newPrice}`);
    }
    console.log(`✓ Seed product PRESERVED edit after reload: price=${checkedSeed.price}`);

    const checkedNew = stateAfterReload.products.find((p) => p.id === created.id);
    if (!checkedNew || checkedNew.title !== `${testTitle} (UPDATED)` || checkedNew.price !== 1399) {
      throw new Error(`FAILED: Created product lost edits after reload! Got title "${checkedNew?.title}"`);
    }
    console.log(`✓ Created product PRESERVED edit after reload: title="${checkedNew.title}", price=${checkedNew.price}`);
  }

  // 5. Check storefront snapshot
  const sfSnapshot = storefrontSnapshot(null);
  const foundInStorefront = sfSnapshot.products.find((p) => p.id === created.id);
  if (!foundInStorefront) {
    throw new Error("FAILED: Product not visible in storefront snapshot!");
  }
  console.log("✓ Product visible in Storefront snapshot");

  // 6. Check admin overview
  const adminSnap = adminOverview(null);
  const foundInAdmin = adminSnap.products.find((p) => p.id === created.id);
  if (!foundInAdmin) {
    throw new Error("FAILED: Product not visible in Admin overview snapshot!");
  }
  console.log("✓ Product visible in Admin Overview snapshot");

  console.log("\n🎉 ALL PRODUCT CREATION, EDITING & RETENTION TESTS PASSED!");
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
