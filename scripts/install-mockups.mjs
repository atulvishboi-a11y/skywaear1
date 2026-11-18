import fs from "fs";
import path from "path";
import sharp from "sharp";

async function processMockups() {
  const publicProductsDir = path.join(process.cwd(), "public", "products");
  fs.mkdirSync(publicProductsDir, { recursive: true });

  const mockupsBase = path.join(process.cwd(), "public", "mockups");

  const mapping = [
    {
      sourceDir: path.join(mockupsBase, "butterfly_final_back"),
      files: [
        { src: "1.png", front: "butterfly-front" },
        { src: "2.png", back: "butterfly-back" },
      ],
    },
    {
      sourceDir: path.join(mockupsBase, "chos0_front"),
      files: [
        { src: "1.png", front: "choso-front" },
        { src: "2.png", back: "choso-back" },
      ],
    },
    {
      sourceDir: path.join(mockupsBase, "limitless__1_"),
      files: [
        { src: "2.png", front: "limitless-front" }, // 2.png has the front chest print
        { src: "1.png", back: "limitless-back" },   // 1.png has the big Gojo back art
      ],
    },
  ];

  for (const item of mapping) {
    for (const f of item.files) {
      const srcPath = path.join(item.sourceDir, f.src);
      const baseName = f.front || f.back;
      const webpPath = path.join(publicProductsDir, `${baseName}.webp`);
      const pngPath = path.join(publicProductsDir, `${baseName}.png`);

      console.log(`Processing ${srcPath} -> ${baseName}.webp / .png`);

      // Optimize to high-quality WebP (< 400 KB) and PNG
      await sharp(srcPath)
        .webp({ quality: 90 })
        .toFile(webpPath);

      await sharp(srcPath)
        .png({ compressionLevel: 8 })
        .toFile(pngPath);

      const webpStat = fs.statSync(webpPath);
      const pngStat = fs.statSync(pngPath);
      console.log(`  ✓ Created ${baseName}.webp (${Math.round(webpStat.size / 1024)} KB) and ${baseName}.png (${Math.round(pngStat.size / 1024)} KB)`);
    }
  }

  console.log("\nAll mockups successfully converted and installed in public/products/!");
}

processMockups().catch((err) => {
  console.error("Error processing mockups:", err);
  process.exit(1);
});
