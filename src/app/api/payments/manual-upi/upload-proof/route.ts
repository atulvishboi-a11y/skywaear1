import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fail, HttpError, ok } from "@/lib/http";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB maximum for payment receipt screenshot
const uploadRateLimit = new Map<string, { count: number; resetAt: number }>();
const MAX_UPLOADS_PER_WINDOW = 10;
const WINDOW_MS = 60 * 60 * 1000; // 1 hour

function checkRateLimit(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = (forwarded ? forwarded.split(",")[0].trim() : null) || request.headers.get("x-real-ip")?.trim() || "anonymous";
  const now = Date.now();
  const entry = uploadRateLimit.get(ip);
  if (!entry || now > entry.resetAt) {
    uploadRateLimit.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }
  if (entry.count >= MAX_UPLOADS_PER_WINDOW) {
    throw new HttpError(429, "Too many file uploads from this network. Please try again later.");
  }
  entry.count += 1;
}

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/pjpeg",
  "image/png",
  "image/webp",
]);

export async function POST(request: Request) {
  try {
    checkRateLimit(request);

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      throw new HttpError(400, "Send payment screenshot as multipart/form-data");
    }

    const file = form.get("file");
    if (!(file instanceof File)) throw new HttpError(422, "No screenshot file received");

    const mime = (file.type || "").toLowerCase();
    const fileName = (file.name || "").toLowerCase();
    const isImageMime = ALLOWED_MIME_TYPES.has(mime) || mime.startsWith("image/");
    const hasImageExt = /\.(jpe?g|png|webp)$/i.test(fileName);

    if (!isImageMime && !hasImageExt) {
      throw new HttpError(422, "Payment screenshot must be a JPG, JPEG, PNG, or WEBP image");
    }

    if (file.size === 0) throw new HttpError(422, "Uploaded file is empty");
    if (file.size > MAX_BYTES) throw new HttpError(422, "Screenshot must be under 10 MB");

    const buffer = Buffer.from(await file.arrayBuffer());

    // Validate true image format via file signature (magic bytes) to prevent executable uploads
    const isJpeg = buffer.length >= 3 && buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
    const isPng = buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
    const isWebp = buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP";

    if (!isJpeg && !isPng && !isWebp) {
      throw new HttpError(422, "File content is not a valid image. Only authentic JPG, PNG, and WEBP formats are accepted.");
    }

    const effectiveMime = isPng ? "image/png" : isWebp ? "image/webp" : "image/jpeg";

    let finalUrl: string | null = null;

    try {
      const ext = effectiveMime.includes("png") ? "png" : effectiveMime.includes("webp") ? "webp" : "jpg";
      const safeName = `proof-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const directory = path.join(process.cwd(), "public", "uploads", "proofs");
      await mkdir(directory, { recursive: true });
      await writeFile(path.join(directory, safeName), buffer);
      finalUrl = `/uploads/proofs/${safeName}`;
    } catch (fsErr) {
      console.warn("[upload-proof] Serverless filesystem write bypassed; falling back to Data URI:", fsErr);
    }

    if (!finalUrl) {
      finalUrl = `data:${effectiveMime};base64,${buffer.toString("base64")}`;
    }

    return ok({ url: finalUrl }, 201);
  } catch (error) {
    console.error("[upload-proof] Failed to process screenshot upload:", error);
    return fail(error);
  }
}
