import fs from "fs";
import path from "path";
import cp from "child_process";

const mockupsDir = "C:/Users/vishw/OneDrive/Desktop/mockups";
const files = fs.readdirSync(mockupsDir);
console.log("Mockup files in desktop folder:", files);

const extractDir = path.join(process.cwd(), "public", "mockups");
fs.mkdirSync(extractDir, { recursive: true });

for (const f of files) {
  if (f.endsWith(".zip")) {
    const zipPath = path.join(mockupsDir, f);
    const subName = f.replace(/\.zip$/i, "").replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();
    const targetSubDir = path.join(extractDir, subName);
    fs.mkdirSync(targetSubDir, { recursive: true });
    try {
      cp.execFileSync("tar", ["-xf", zipPath, "-C", targetSubDir]);
      console.log(`Extracted ${f} into ${subName}:`, fs.readdirSync(targetSubDir));
    } catch (e) {
      console.error(`Error extracting ${f}:`, e.message);
    }
  }
}
