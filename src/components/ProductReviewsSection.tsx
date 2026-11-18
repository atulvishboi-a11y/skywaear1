import React, { useState, useRef } from "react";
import { Star, CheckCircle2, MessageSquare, ThumbsUp, Sparkles, Send, Camera, X, Loader2, UploadCloud } from "lucide-react";
import type { ProductReview } from "@/lib/domain";
import { api } from "@/lib/client";

interface ProductReviewsSectionProps {
  productId: string;
  productTitle: string;
  initialRating: number;
  initialReviewsCount: number;
  initialReviews?: ProductReview[];
  onReviewSubmitted?: (newReview: ProductReview) => void;
}

export default function ProductReviewsSection({
  productId,
  productTitle,
  initialRating,
  initialReviewsCount,
  initialReviews = [],
  onReviewSubmitted,
}: ProductReviewsSectionProps) {
  const [reviews, setReviews] = useState<ProductReview[]>(initialReviews);
  const [isWriting, setIsWriting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form State
  const [authorName, setAuthorName] = useState("");
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [sizePurchased, setSizePurchased] = useState("L");
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const compressImageForUpload = async (file: File): Promise<File> => {
    return new Promise((resolve) => {
      if (!file.type.startsWith("image/") && !/\.(jpe?g|png|webp)$/i.test(file.name)) {
        return resolve(file);
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const MAX_DIM = 1280;
          let width = img.width;
          let height = img.height;

          if (width > height && width > MAX_DIM) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else if (height > MAX_DIM) {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) return resolve(file);
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (!blob) return resolve(file);
              const compressedFile = new File(
                [blob],
                file.name.replace(/\.[^/.]+$/, ".jpg"),
                { type: "image/jpeg", lastModified: Date.now() }
              );
              resolve(compressedFile);
            },
            "image/jpeg",
            0.85
          );
        };
        img.onerror = () => resolve(file);
        img.src = e.target?.result as string;
      };
      reader.onerror = () => resolve(file);
      reader.readAsDataURL(file);
    });
  };

  const processAndUploadFile = async (rawFile: File) => {
    const isImage = rawFile.type.startsWith("image/") || /\.(jpe?g|png|webp)$/i.test(rawFile.name);
    if (!isImage) {
      setError("Please select a valid image file (JPG, JPEG, PNG, or WEBP)");
      return;
    }
    if (rawFile.size > 15 * 1024 * 1024) {
      setError("Image size must be under 15 MB");
      return;
    }

    setUploadingImage(true);
    setError(null);
    try {
      const fileToUpload = await compressImageForUpload(rawFile);
      const res = await api.uploadReviewPhoto(fileToUpload);
      setImageUrl(res.url);
    } catch (err) {
      console.error("Photo upload error:", err);
      setError(err instanceof Error ? err.message : "Failed to upload photo");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void processAndUploadFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      void processAndUploadFile(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authorName.trim()) {
      setError("Please enter your name");
      return;
    }
    if (!comment.trim() || comment.trim().length < 5) {
      setError("Please write at least a short 5-character review");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await api.submitReview({
        productId,
        authorName: authorName.trim(),
        rating,
        title: title.trim() || undefined,
        comment: comment.trim(),
        sizePurchased,
        imageUrl: imageUrl ?? undefined,
      });

      if (res.success && res.review) {
        setReviews((prev) => [res.review, ...prev]);
        setSuccessMsg("Thank you! Your verified review and photo have been posted live.");
        setIsWriting(false);
        setAuthorName("");
        setTitle("");
        setComment("");
        setImageUrl(null);
        setRating(5);
        onReviewSubmitted?.(res.review);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to post review");
    } finally {
      setSubmitting(false);
    }
  };

  const avgRating = reviews.length > 0
    ? Number((reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1))
    : initialRating;
  const count = Math.max(reviews.length, initialReviewsCount);

  return (
    <section className="mt-6 sm:mt-8 pt-10 border-t border-[#282C34] font-mono">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.25em] text-[#00FF66] mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Community Verified Telemetry</span>
          </div>
          <h2
            className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-white font-sans"
            style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}
          >
            Customer Ratings &amp; Reviews
          </h2>
        </div>

        <button
          onClick={() => {
            setIsWriting(!isWriting);
            setError(null);
            setSuccessMsg(null);
          }}
          className="px-5 py-2.5 bg-[#00FF66] text-[#0B0C10] font-black text-xs uppercase tracking-wider hover:bg-white transition-colors cursor-pointer flex items-center justify-center gap-2 shrink-0 shadow-lg"
          style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>{isWriting ? "Close Review Form" : "Write A Live Review"}</span>
        </button>
      </div>

      {successMsg && (
        <div className="p-4 bg-[#00FF66]/10 border border-[#00FF66]/40 text-[#00FF66] text-xs font-bold flex items-center gap-2 mb-6">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Review Form Drawer / Box */}
      {isWriting && (
        <form onSubmit={handleSubmit} className="mb-10 p-6 bg-[#16181D] border-2 border-[#00FF66] space-y-4">
          <div className="border-b border-[#282C34] pb-3">
            <h3 className="text-base font-bold text-white uppercase" style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}>
              Share your fit &amp; fabric experience for {productTitle}
            </h3>
            <p className="text-xs text-[#8E929B] mt-0.5">
              Your feedback is published immediately to the live community ledger.
            </p>
          </div>

          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/40 text-rose-400 text-xs">
              {error}
            </div>
          )}

          {/* Star Rating Select */}
          <div>
            <label className="block text-[11px] font-bold uppercase text-[#8E929B] mb-1.5">
              Overall Rating:
            </label>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  type="button"
                  key={star}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(null)}
                  onClick={() => setRating(star)}
                  className="p-1 focus:outline-none"
                >
                  <Star
                    className={`w-6 h-6 transition-colors ${
                      (hoverRating !== null ? star <= hoverRating : star <= rating)
                        ? "fill-[#00FF66] text-[#00FF66]"
                        : "text-[#282C34]"
                    }`}
                  />
                </button>
              ))}
              <span className="text-xs font-bold text-white ml-2">
                {rating === 5 ? "5/5 — Masterpiece" : rating === 4 ? "4/5 — Solid Heavyweight" : `${rating}/5 Stars`}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold uppercase text-[#8E929B] mb-1">
                Your Full Name *
              </label>
              <input
                type="text"
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                placeholder="e.g. Rahul Sharma"
                required
                className="w-full h-10 px-3 bg-[#0B0C10] border border-[#282C34] text-xs text-white placeholder-[#8E929B]/50 focus:outline-none focus:border-[#00FF66]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase text-[#8E929B] mb-1">
                Size Ordered
              </label>
              <select
                value={sizePurchased}
                onChange={(e) => setSizePurchased(e.target.value)}
                className="w-full h-10 px-3 bg-[#0B0C10] border border-[#282C34] text-xs text-white focus:outline-none focus:border-[#00FF66] cursor-pointer"
              >
                {["S", "M", "L", "XL", "2XL"].map((sz) => (
                  <option key={sz} value={sz} className="bg-[#0B0C10] text-white">
                    {sz} (Oversized Boxy Fit)
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase text-[#8E929B] mb-1">
              Headline / Summary (Optional)
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Best 240 GSM drop in India"
              className="w-full h-10 px-3 bg-[#0B0C10] border border-[#282C34] text-xs text-white placeholder-[#8E929B]/50 focus:outline-none focus:border-[#00FF66]"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase text-[#8E929B] mb-1">
              Detailed Review *
            </label>
            <textarea
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="How does the fabric drape? How does the neck rib and screenprint feel after wash?"
              required
              className="w-full p-3 bg-[#0B0C10] border border-[#282C34] text-xs text-white placeholder-[#8E929B]/50 focus:outline-none focus:border-[#00FF66]"
            />
          </div>

          {/* Photo Upload Section */}
          <div className="pt-1">
            <label className="block text-[11px] font-bold uppercase text-[#8E929B] mb-1.5 flex items-center justify-between">
              <span>Attach Product Photo (Optional)</span>
              <span className="text-[10px] text-[#00FF66]/80 font-mono">drag &amp; drop or click</span>
            </label>

            {imageUrl ? (
              <div className="flex items-center gap-4 p-3 bg-[#0B0C10] border border-[#00FF66]">
                <div className="relative group shrink-0">
                  <img
                    src={imageUrl}
                    alt="Review uploaded photo"
                    className="w-20 h-20 sm:w-24 sm:h-24 object-cover border border-[#282C34]"
                  />
                  <button
                    type="button"
                    onClick={() => setImageUrl(null)}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-rose-600 text-white flex items-center justify-center hover:bg-rose-500 transition-colors shadow-lg"
                    title="Remove photo"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#00FF66] uppercase tracking-wider mb-1">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>Photo Attached Successfully</span>
                  </div>
                  <p className="text-[11px] text-[#8E929B] mb-2 truncate">
                    Will appear live with your verified review.
                  </p>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-[10px] uppercase font-bold text-white hover:text-[#00FF66] underline cursor-pointer"
                  >
                    Change photo
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*,.jpg,.jpeg,.png,.webp"
                    onChange={handleImageFileChange}
                    className="hidden"
                  />
                </div>
              </div>
            ) : (
              <div
                onDragOver={handleDragOver}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed p-6 text-center cursor-pointer transition-all duration-200 select-none ${
                  isDragging
                    ? "border-[#00FF66] bg-[#00FF66]/15 scale-[1.01] shadow-[0_0_20px_rgba(0,255,102,0.2)]"
                    : "border-[#282C34] hover:border-[#00FF66] bg-[#0B0C10] hover:bg-[#111317]"
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*,.jpg,.jpeg,.png,.webp"
                  onChange={handleImageFileChange}
                  className="hidden"
                />
                {uploadingImage ? (
                  <div className="flex flex-col items-center justify-center gap-2 py-2">
                    <Loader2 className="w-8 h-8 animate-spin text-[#00FF66]" />
                    <span className="text-xs font-bold uppercase tracking-wider text-[#00FF66]">
                      Uploading &amp; Optimizing Photo…
                    </span>
                    <span className="text-[10px] text-[#8E929B]">Please wait a second</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-2 py-2 pointer-events-none">
                    <div
                      className={`w-12 h-12 flex items-center justify-center transition-colors ${
                        isDragging ? "bg-[#00FF66] text-[#0B0C10]" : "bg-[#16181D] text-[#00FF66]"
                      }`}
                    >
                      {isDragging ? (
                        <UploadCloud className="w-6 h-6 animate-bounce" />
                      ) : (
                        <Camera className="w-6 h-6" />
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase tracking-wider text-white">
                        {isDragging ? "Drop your photo right here!" : "Drag & drop your product photo here"}
                      </p>
                      <p className="text-[11px] text-[#8E929B] mt-0.5">
                        or <span className="text-[#00FF66] underline font-bold">click to browse</span> files
                      </p>
                    </div>
                    <span className="text-[10px] text-[#8E929B]/60 uppercase tracking-widest font-mono">
                      PNG, JPG, WEBP • Max 5MB
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsWriting(false)}
              className="px-4 py-2 border border-[#282C34] text-xs uppercase font-bold text-[#8E929B] hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 bg-[#00FF66] text-[#0B0C10] font-black text-xs uppercase tracking-wider hover:bg-white transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{submitting ? "Posting…" : "Submit Review"}</span>
            </button>
          </div>
        </form>
      )}

      {/* Overview Stats Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="p-5 bg-[#16181D] border border-[#282C34] flex items-center gap-4">
          <div className="text-4xl font-black text-white">{avgRating}</div>
          <div>
            <div className="flex items-center gap-1 text-[#00FF66]">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  className={`w-4 h-4 ${
                    s <= Math.round(avgRating) ? "fill-[#00FF66]" : "fill-transparent text-[#282C34]"
                  }`}
                />
              ))}
            </div>
            <p className="text-[11px] text-[#8E929B] mt-1 font-mono">
              Based on {count} verified streetwear buyers
            </p>
          </div>
        </div>

        <div className="p-5 bg-[#16181D] border border-[#282C34] flex flex-col justify-between">
          <span className="text-[10px] font-bold text-[#8E929B] uppercase">Fit Profile</span>
          <p className="text-sm font-bold text-white uppercase mt-1">98% True to Oversized</p>
          <span className="text-[10px] text-[#00FF66]">Pre-shrunk combed terry holds shape</span>
        </div>

        <div className="p-5 bg-[#16181D] border border-[#282C34] flex flex-col justify-between">
          <span className="text-[10px] font-bold text-[#8E929B] uppercase">Print Quality</span>
          <p className="text-sm font-bold text-white uppercase mt-1">Discharge &amp; Puff Ink</p>
          <span className="text-[10px] text-[#00F0FF]">Zero cracking after 50+ domestic washes</span>
        </div>
      </div>

      {/* Reviews List */}
      <div className="space-y-3">
        {reviews.length === 0 ? (
          <div className="p-8 bg-[#16181D] border border-[#282C34] text-center space-y-2">
            <p className="text-xs text-white uppercase font-bold">Be the first to review this drop!</p>
            <p className="text-[11px] text-[#8E929B]">
              Share your fit and comfort thoughts to earn respect in the community.
            </p>
          </div>
        ) : (
          reviews.map((rev) => (
            <div key={rev.id} className="p-5 bg-[#16181D] border border-[#282C34] space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#282C34] pb-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 bg-[#0B0C10] border border-[#282C34] text-white flex items-center justify-center font-bold text-xs uppercase">
                    {rev.authorName.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-white uppercase">{rev.authorName}</span>
                      {rev.verifiedPurchase && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.2 bg-[#00FF66]/10 text-[#00FF66] border border-[#00FF66]/30 text-[9px] font-bold uppercase">
                          <CheckCircle2 className="w-3 h-3" />
                          Verified Buyer
                        </span>
                      )}
                    </div>
                    {rev.sizePurchased && (
                      <span className="text-[10px] text-[#8E929B]">
                        Size: {rev.sizePurchased} · Oversized Cut
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 text-[#00FF66]">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      className={`w-3.5 h-3.5 ${
                        s <= rev.rating ? "fill-[#00FF66]" : "fill-transparent text-[#282C34]"
                      }`}
                    />
                  ))}
                </div>
              </div>

              {rev.title && (
                <h4 className="text-xs font-bold text-white uppercase">
                  {rev.title}
                </h4>
              )}

              <p className="text-xs text-[#A0A5B5] leading-relaxed">
                "{rev.comment}"
              </p>

              {rev.imageUrl && (
                <div className="pt-1">
                  <div className="inline-block border border-[#282C34] bg-[#0B0C10] p-1">
                    <img
                      src={rev.imageUrl}
                      alt={`Photo review by ${rev.authorName}`}
                      className="w-24 h-24 sm:w-32 sm:h-32 object-cover block cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => window.open(rev.imageUrl, "_blank")}
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between text-[10px] text-[#8E929B] pt-1">
                <span>{new Date(rev.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</span>
                <span className="flex items-center gap-1 text-[#00FF66]">
                  <ThumbsUp className="w-3 h-3" /> Helpful Review
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
