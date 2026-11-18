import { fail, ok, readBody, HttpError } from "@/lib/http";
import { sendMobileOtp, sendEmailOtpOrLink } from "@/lib/server/otpService";
import { redisGet, redisSet } from "@/lib/server/redis";
import { readState, ensureStateLoaded } from "@/lib/server/store";

const lastOtpSentTimes = new Map<string, number>();
const isDev = !process.env.VERCEL && process.env.NODE_ENV !== "production";
const SEND_COOLDOWN_MS = isDev ? 30 * 1000 : 60 * 1000; // 30s localhost dev, 60s prod
const MAX_SENDS_PER_NUMBER_HOUR = 5;
const MAX_SENDS_PER_NUMBER_DAY = 10;
const MAX_SENDS_PER_IP_HOUR = 20;

function clientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim() || null;
  return request.headers.get("x-real-ip")?.trim() || null;
}

async function consumeSendBudget(key: string, limit: number, ttlSeconds: number, message: string) {
  let count = 0;
  try {
    count = (await redisGet<number>(key)) || 0;
  } catch {}
  if (count >= limit) {
    throw new HttpError(429, message);
  }
  try {
    await redisSet(key, count + 1, ttlSeconds);
  } catch {}
}

export async function POST(request: Request) {
  try {
    const body = await readBody<{ target: string; type?: "signup" | "reset" | "login" }>(request);
    if (!body.target || !body.target.trim()) {
      throw new HttpError(422, "Please provide a valid Indian mobile number or email address.");
    }

    const cleanTarget = body.target.trim();
    const type = body.type || "signup";

    // Normalize phone identifier (handles +91, 0 prefix, or raw 10 digits)
    let rawDigits = cleanTarget.replace(/\D/g, "");
    if (rawDigits.startsWith("91") && rawDigits.length > 10) rawDigits = rawDigits.slice(2);
    else if (rawDigits.startsWith("0") && rawDigits.length > 10) rawDigits = rawDigits.slice(1);
    const last10 = rawDigits.length >= 10 ? rawDigits.slice(-10) : rawDigits;

    const throttleKey = cleanTarget.includes("@") ? cleanTarget.toLowerCase() : last10;
    const now = Date.now();

    // Check account existence based on auth flow type
    if (type === "signup") {
      await ensureStateLoaded();
      const state = readState();
      const existing = (state.customers || []).find((c) => {
        if (cleanTarget.includes("@")) {
          return c.email && c.email.toLowerCase() === cleanTarget.toLowerCase();
        }
        return Boolean(last10 && (c.phone || "").replace(/\D/g, "").endsWith(last10));
      });

      if (existing) {
        throw new HttpError(
          409,
          `An account is already registered with this ${cleanTarget.includes("@") ? "email" : "mobile number"}. Please log in to your account.`
        );
      }
    } else if (type === "login") {
      await ensureStateLoaded();
      const state = readState();
      const existing = (state.customers || []).find((c) => {
        if (cleanTarget.includes("@")) {
          return c.email && c.email.toLowerCase() === cleanTarget.toLowerCase();
        }
        return Boolean(last10 && (c.phone || "").replace(/\D/g, "").endsWith(last10));
      });

      if (!existing) {
        throw new HttpError(
          404,
          `No account found with this ${cleanTarget.includes("@") ? "email" : "mobile number"}. Please create an account first.`
        );
      }
    }

    // 1. Check in-memory rate-limit
    const lastSentMem = lastOtpSentTimes.get(throttleKey);
    if (lastSentMem && now - lastSentMem < SEND_COOLDOWN_MS) {
      const waitSec = Math.ceil((SEND_COOLDOWN_MS - (now - lastSentMem)) / 1000);
      throw new HttpError(429, `Please wait ${waitSec} seconds before requesting a new verification code.`);
    }

    // 2. Check distributed Redis rate-limit
    let lastSentRedis: number | null = null;
    try {
      lastSentRedis = await redisGet<number>(`otp_cooldown:${throttleKey}`);
    } catch {}
    if (lastSentRedis && now - lastSentRedis < SEND_COOLDOWN_MS) {
      const waitSec = Math.ceil((SEND_COOLDOWN_MS - (now - lastSentRedis)) / 1000);
      throw new HttpError(429, `Please wait ${waitSec} seconds before requesting a new verification code.`);
    }

    const ip = clientIp(request);
    if (ip) {
      await consumeSendBudget(
        `otp_rate:ip:${ip}`,
        MAX_SENDS_PER_IP_HOUR,
        60 * 60,
        "Too many verification codes requested from this network. Please try again later."
      );
    }

    if (cleanTarget.includes("@")) {
      if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(cleanTarget)) {
        throw new HttpError(422, "Please enter a valid email address.");
      }

      await consumeSendBudget(
        `otp_rate:hour:${throttleKey}`,
        MAX_SENDS_PER_NUMBER_HOUR,
        60 * 60,
        "Too many verification codes requested for this email. Please try again after an hour."
      );
      await consumeSendBudget(
        `otp_rate:day:${throttleKey}`,
        MAX_SENDS_PER_NUMBER_DAY,
        24 * 60 * 60,
        "Daily verification code limit reached for this email. Please try again tomorrow."
      );

      const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || "";
      const resetLink = type === "reset" && appBaseUrl ? `${appBaseUrl}/forgot-password?identifier=${encodeURIComponent(cleanTarget)}` : undefined;

      const result = await sendEmailOtpOrLink(cleanTarget, {
        type: type === "login" ? "signup" : type,
        resetLink,
      });

      lastOtpSentTimes.set(throttleKey, now);
      redisSet(`otp_cooldown:${throttleKey}`, now, isDev ? 30 : 60).catch(() => {});

      return ok({
        success: result.success,
        message: result.message,
        ...(process.env.NODE_ENV === "development" && result.otp ? { otp: result.otp, simulated: result.simulated } : {}),
      });
    }

    if (last10.length < 10) {
      throw new HttpError(422, "Please enter a valid 10-digit Indian mobile number.");
    }

    await consumeSendBudget(
      `otp_rate:hour:${throttleKey}`,
      MAX_SENDS_PER_NUMBER_HOUR,
      60 * 60,
      "Too many verification codes requested for this number. Please try again after an hour."
    );
    await consumeSendBudget(
      `otp_rate:day:${throttleKey}`,
      MAX_SENDS_PER_NUMBER_DAY,
      24 * 60 * 60,
      "Daily verification code limit reached for this number. Please try again tomorrow."
    );

    const result = await sendMobileOtp(last10);
    if (!result.success) {
      throw new HttpError(502, result.message || "Failed to deliver SMS verification code.");
    }

    lastOtpSentTimes.set(throttleKey, now);
    redisSet(`otp_cooldown:${throttleKey}`, now, isDev ? 10 : 60).catch(() => {});

    return ok({
      success: true,
      message: result.message,
      ...(process.env.NODE_ENV === "development" && result.otp ? { otp: result.otp, simulated: result.simulated } : {}),
    });
  } catch (error) {
    return fail(error);
  }
}
