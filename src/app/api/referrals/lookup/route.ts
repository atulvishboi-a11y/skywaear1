import { NextResponse } from "next/server";
import { lookupReferralCode, recordReferralFingerprint } from "@/lib/server/services";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code") || "";

    if (!code.trim()) {
      return NextResponse.json({ valid: false, message: "Code required" }, { status: 400 });
    }

    const result = lookupReferralCode(code);

    // If valid, also register device fingerprint for fallback PWA recovery
    if (result.valid && result.code) {
      const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
      const ua = request.headers.get("user-agent") || "";
      recordReferralFingerprint(ip, ua, result.code, result.name || "VIP Member");
    }

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ valid: false, error: err?.message }, { status: 500 });
  }
}
