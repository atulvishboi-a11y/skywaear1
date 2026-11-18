import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fail, HttpError, ok } from "@/lib/http";
import { readAdminSession } from "@/lib/server/auth";

const MAX_BYTES = 12 * 1024 * 1024; // 12 MB limit

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/pjpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);

/**
 * Upload back-print artwork or front garment mockup.
 * If running in a local environment with a writable disk, writes to public/products/uploads.
 * In serverless environments with a read-only filesystem (e.g. Vercel), gracefully falls back
 * to a base64 Data URI so uploads never fail.
 */
export async function POST(request: Request) {
  try {
    if (!(await readAdminSession())) throw new HttpError(401, "Admin login required");

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      throw new HttpError(400, "Send the image as multipart/form-data");
    }

    const file = form.get("file");
    if (!(file instanceof File)) throw new HttpError(422, "No image received");

    const mime = (file.type || "").toLowerCase();
    const fileName = (file.name || "").toLowerCase();
    const isImageMime = ALLOWED_MIME_TYPES.has(mime) || mime.startsWith("image/");
    const hasImageExt = /\.(jpe?g|png|webp|avif)$/i.test(fileName);

    if (!isImageMime && !hasImageExt) {
      throw new HttpError(422, "Artwork must be a PNG, JPG, or WEBP image");
    }

    if (file.size === 0) throw new HttpError(422, "That file is empty");
    if (file.size > MAX_BYTES) {
      throw new HttpError(422, `Artwork must be under ${Math.round(MAX_BYTES / 1024 / 1024)} MB`);
    }

    const arrayBuf = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);

    let ext = "jpg";
    if (mime.includes("png") || fileName.endsWith(".png")) ext = "png";
    else if (mime.includes("webp") || fileName.endsWith(".webp")) ext = "webp";
    else if (mime.includes("avif") || fileName.endsWith(".avif")) ext = "avif";

    const effectiveMime = mime && ALLOWED_MIME_TYPES.has(mime) ? mime : `image/${ext === "jpg" ? "jpeg" : ext}`;

    let finalUrl: string | null = null;

    // Try saving locally if filesystem is writable
    try {
      const name = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const directory = path.join(process.cwd(), "public", "products", "uploads");
      await mkdir(directory, { recursive: true });
      await writeFile(path.join(directory, name), buffer);
      finalUrl = `/products/uploads/${name}`;
    } catch (fsErr) {
      // Vercel serverless has a read-only filesystem (EROFS). Convert directly to base64 Data URL!
      console.warn("[admin/assets] Serverless filesystem write bypassed; falling back to Data URI:", fsErr);
    }

    // Graceful fallback: Base64 Data URI
    if (!finalUrl) {
      finalUrl = `data:${effectiveMime};base64,${buffer.toString("base64")}`;
    }

    return ok({ url: finalUrl }, 201);
  } catch (error) {
    console.error("[admin/assets] Upload error:", error);
    return fail(error);
  }
}
