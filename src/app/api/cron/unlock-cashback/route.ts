import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { fail, ok } from "@/lib/http";
import { triggerScheduledCashbackUnlock } from "@/lib/server/services";

function timingSafeMatch(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

function isAuthorized(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    if (process.env.NODE_ENV === "production") {
      console.error("[Cron Security] CRON_SECRET is missing in production environment. Rejecting cron request.");
      return false;
    }
    // Permitted only in local development
    return true;
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader) {
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (timingSafeMatch(token, cronSecret)) {
      return true;
    }
  }

  // Only permit URL query secret in development; never in production to prevent log leakage
  if (process.env.NODE_ENV !== "production") {
    const { searchParams } = new URL(request.url);
    const querySecret = searchParams.get("secret") || "";
    if (querySecret && timingSafeMatch(querySecret, cronSecret)) {
      return true;
    }
  }

  return false;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await triggerScheduledCashbackUnlock("System (Scheduled Cron GET)");
    return ok(result);
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await triggerScheduledCashbackUnlock("System (Scheduled Cron POST)");
    return ok(result);
  } catch (error) {
    return fail(error);
  }
}
