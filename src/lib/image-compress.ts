/**
 * Client-Side Image Compression Utility
 * Prevents HTTP 413 (Payload Too Large) on Vercel by resizing and compressing
 * heavy camera/artwork files (5MB-20MB) down to crisp ~150-300KB WebP/JPEG images.
 */

export interface CompressionOptions {
  maxDimension?: number;
  quality?: number;
  outputFormat?: "image/webp" | "image/jpeg";
}

export async function compressImageClient(
  file: File,
  options: CompressionOptions = {}
): Promise<{ file: File; dataUrl: string; sizeReductionRatio: string }> {
  const {
    maxDimension = 1600,
    quality = 0.85,
  } = options;

  if (typeof window === "undefined" || typeof document === "undefined") {
    return { file, dataUrl: "", sizeReductionRatio: "1.0x" };
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Unable to read image file"));
    reader.onload = (e) => {
      const src = e.target?.result as string;
      if (!src) return reject(new Error("File content is empty"));

      const img = new Image();
      img.onerror = () => reject(new Error("Selected file is not a valid or readable image"));
      img.onload = () => {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        // If dimensions exceed maxDimension, proportionally scale down
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          return resolve({ file, dataUrl: src, sizeReductionRatio: "1.0x" });
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, width, height);

        // Choose optimal format: WEBP if supported/requested, else JPEG
        const chosenFormat = options.outputFormat || (file.type === "image/webp" ? "image/webp" : "image/jpeg");
        const compressedDataUrl = canvas.toDataURL(chosenFormat, quality);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              return resolve({ file, dataUrl: compressedDataUrl, sizeReductionRatio: "1.0x" });
            }

            const ext = chosenFormat === "image/webp" ? ".webp" : ".jpg";
            const newName = file.name.replace(/\.[^/.]+$/, "") + ext;
            const compressedFile = new File([blob], newName, {
              type: chosenFormat,
              lastModified: Date.now(),
            });

            const ratio = (file.size / Math.max(1, blob.size)).toFixed(1);
            console.log(
              `[image-compress] Compressed "${file.name}" (${(file.size / 1024 / 1024).toFixed(2)} MB -> ${(blob.size / 1024).toFixed(1)} KB, reduced by ${ratio}x)`
            );

            resolve({
              file: compressedFile,
              dataUrl: compressedDataUrl,
              sizeReductionRatio: `${ratio}x`,
            });
          },
          chosenFormat,
          quality
        );
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
}
