import { NextResponse } from "next/server";
import { getProductReviews, submitProductReview } from "@/lib/server/services";
import { HttpError } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get("productId");
    if (!productId) {
      return NextResponse.json({ error: "productId parameter is required" }, { status: 400 });
    }
    const reviews = await getProductReviews(productId);
    return NextResponse.json({ reviews });
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Failed to load reviews";
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await submitProductReview(body);
    return NextResponse.json(result);
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Failed to submit review";
    return NextResponse.json({ error: message }, { status });
  }
}
