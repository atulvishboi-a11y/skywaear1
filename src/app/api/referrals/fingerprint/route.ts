import { NextResponse } from "next/server";
import { matchReferralFingerprint } from "@/lib/server/services";

export async function GET(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
    const ua = request.headers.get("user-agent") || "";

    const match = matchReferralFingerprint(ip, ua);
    if (match) {
      return NextResponse.json({
        recovered: true,
        code: match.code,
        name: match.name,
      });
    }

    return NextResponse.json({ recovered: false });
  } catch (err: any) {
    return NextResponse.json({ recovered: false, error: err?.message }, { status: 500 });
  }
}
