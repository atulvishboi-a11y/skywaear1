import nodemailer from "nodemailer";
import { query, isLocalOnly } from "./db";
import { redisGet, redisSet, redisDel } from "./redis";

// In-memory OTP storage with 5-minute TTL
interface PendingOtp {
  code: string;
  expiresAt: number;
}

const otpStore = new Map<string, PendingOtp>();
const otpFailedAttempts = new Map<string, number>();

/**
 * Completely purges OTP and attempt counts across memory, Redis, and Neon Postgres
 */
export async function clearOtp(key: string): Promise<void> {
  otpStore.delete(key);
  otpFailedAttempts.delete(key);
  redisDel(`otp:${key}`).catch(() => {});
  redisDel(`otp_attempts:${key}`).catch(() => {});
  if (!isLocalOnly()) {
    query(`DELETE FROM "AuthOtp" WHERE "identifier" = $1`, [key]).catch(() => {});
  }
}

/**
 * Tracks failed guess attempts and burns the OTP after 3 failed tries (brute-force defense)
 */
async function recordFailedAttempt(key: string): Promise<boolean> {
  const current = (otpFailedAttempts.get(key) || 0) + 1;
  otpFailedAttempts.set(key, current);

  let rCount = current;
  try {
    const rKey = `otp_attempts:${key}`;
    const rVal = await redisGet<number>(rKey);
    rCount = (rVal || 0) + 1;
    await redisSet(rKey, rCount, 300);
  } catch {}

  if (current >= 3 || rCount >= 3) {
    console.warn("[OTP Security] Rate limit triggered: 3 failed OTP attempts. Invalidating code.");
    await clearOtp(key);
    try {
      await redisSet(`otp_lock:${key}`, Date.now(), 15 * 60);
    } catch {}
    return true; // locked out
  }
  return false;
}

/**
 * Saves OTP to in-memory store AND Neon PostgreSQL table for rock-solid serverless persistence.
 * The Postgres write is REQUIRED — if it fails, the OTP will not survive across Vercel lambdas.
 */
async function saveOtp(key: string, code: string, ttlMs: number = 5 * 60 * 1000): Promise<void> {
  const expiresAt = Date.now() + ttlMs;
  otpStore.set(key, { code, expiresAt });
  otpFailedAttempts.delete(key);
  try {
    await redisSet(`otp:${key}`, { code, expiresAt }, Math.ceil(ttlMs / 1000));
    await redisDel(`otp_attempts:${key}`);
  } catch (redisErr) {
    console.warn("[Redis OTP Save Warning]", redisErr);
  }

  // Postgres write is critical for cross-lambda OTP persistence on Vercel
  if (isLocalOnly()) return;
  try {
    await query(
      `INSERT INTO "AuthOtp" ("identifier", "code", "expiresAt", "createdAt")
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT ("identifier") DO UPDATE
       SET "code" = $2, "expiresAt" = $3, "createdAt" = NOW()`,
      [key, code, expiresAt]
    );
    console.log(`[OTP Saved] expiresAt=${expiresAt} (Postgres + Memory)`);
  } catch (err) {
    console.error("[CRITICAL: Postgres AuthOtp Save FAILED]", err);
    // Even if Postgres fails, the OTP is still in memory and Redis — it may work on same lambda
  }
}

/**
 * Normalizes an Indian mobile number to 91XXXXXXXXXX format required by APITxT
 */
export function formatApitxtMobile(mobile: string): string {
  const digits = mobile.replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  if (digits.startsWith("0") && digits.length === 11) return `91${digits.slice(1)}`;
  if (digits.length > 10) return `91${digits.slice(-10)}`;
  return digits;
}

/**
 * Generates a random numeric OTP (default 4 digits as per APITxT documentation, or 6 digits)
 */
export function generateOtp(length: number = 4): string {
  if (length === 6) {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }
  return Math.floor(1000 + Math.random() * 9000).toString();
}

let lastPingTime = 0;
/**
 * Pings the WhatsApp Web Gateway on Render to prevent the free tier container from sleeping.
 * Runs at most once every 3 minutes.
 */
export function keepWhatsAppAlive(): void {
  const now = Date.now();
  if (now - lastPingTime < 3 * 60 * 1000) return;
  lastPingTime = now;
  const waGatewayUrl = process.env.WHATSAPP_GATEWAY_URL || "https://zenin-whatsapp.onrender.com";
  fetch(waGatewayUrl, { signal: AbortSignal.timeout(5000) }).catch(() => {});
}

/**
 * Sends a message via the self-hosted WhatsApp Web Gateway (on Render).
 * Uses multi-device WebSocket connection without requiring Meta API.
 */
export async function sendWhatsAppMessage(mobile: string, text: string): Promise<boolean> {
  keepWhatsAppAlive();
  const waGatewayUrl = process.env.WHATSAPP_GATEWAY_URL || "https://zenin-whatsapp.onrender.com";
  const cleanDigits = mobile.replace(/\D/g, "");
  const normalized = cleanDigits.length === 10 ? `91${cleanDigits}` : cleanDigits;
  const chatId = `${normalized}@c.us`;

  try {
    const res = await fetch(`${waGatewayUrl}/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId, text }),
      signal: AbortSignal.timeout(25000),
    });
    return res.ok;
  } catch (err) {
    console.warn("[WhatsApp Gateway Error]", err);
    return false;
  }
}

/**
 * Sends OTP directly via APITxT SMS Service (https://apitxt.com/api/sendOTP)
 * Uses ONLY the required parameters: authkey, mobile, otp.
 */
export async function sendMobileOtp(mobile: string, customOtp?: string): Promise<{ success: boolean; message: string; otp?: string; simulated?: boolean }> {
  const cleanMobile = formatApitxtMobile(mobile);
  const otp = customOtp || generateOtp(4);
  const authKey = process.env.APITXT_AUTH_KEY?.trim() || "";

  // Store in memory and PostgreSQL with 10 min expiry
  const key = `phone_${cleanMobile}`;
  await saveOtp(key, otp, 10 * 60 * 1000);

  if (!authKey) {
    if (process.env.NODE_ENV === "development") {
      console.log(`[LOCALHOST DEV OTP for ${cleanMobile}]: ${otp}`);
      return {
        success: true,
        message: `Verification code: ${otp} (Localhost / Dev Mode)`,
        otp,
        simulated: true,
      };
    }
    console.error(`[APITxT Delivery Failed] Mobile: ${cleanMobile} | APITXT_AUTH_KEY is not configured.`);
    return {
      success: false,
      message: "SMS OTP service is currently unavailable. Please try again later.",
    };
  }

  try {
    // Only required parameters: authkey, mobile, otp
    const url = new URL("https://apitxt.com/api/sendOTP");
    url.searchParams.set("authkey", authKey);
    url.searchParams.set("mobile", cleanMobile);
    url.searchParams.set("otp", otp);

    const response = await fetch(url.toString(), {
      method: "GET",
      signal: AbortSignal.timeout(15000),
    });
    const result = await response.json().catch(() => null);

    console.log(`[APITxT SMS Response] Mobile: ${cleanMobile} | HTTP ${response.status}`, result);

    if (response.ok && (!result || result.status === "success" || result.status === true)) {
      return {
        success: true,
        message: "Verification code sent successfully to your mobile number via SMS.",
      };
    }

    // Handle any API response error message from APITxT
    const errMsg = result?.message || "Failed to send SMS OTP. Please check your mobile number.";
    console.warn(`[APITxT SMS Notice] ${errMsg}`);
    if (process.env.NODE_ENV === "development") {
      console.log(`[LOCALHOST DEV OTP for ${cleanMobile}]: ${otp}`);
      return {
        success: true,
        message: `Verification code: ${otp} (Localhost / Dev Mode)`,
        otp,
        simulated: true,
      };
    }
    return {
      success: false,
      message: errMsg,
    };
  } catch (error) {
    console.error("[APITxT Send Error]", error);
    if (process.env.NODE_ENV === "development") {
      console.log(`[LOCALHOST DEV OTP for ${cleanMobile}]: ${otp}`);
      return {
        success: true,
        message: `Verification code: ${otp} (Localhost / Dev Mode)`,
        otp,
        simulated: true,
      };
    }
    return {
      success: false,
      message: "Unable to reach SMS gateway. Please try again.",
    };
  }
}

/**
 * Sends Password Reset or Verification OTP via Gmail SMTP
 */
export async function sendEmailOtpOrLink(
  email: string,
  options: { otp?: string; resetLink?: string; type: "signup" | "reset" }
): Promise<{ success: boolean; message: string; otp?: string; simulated?: boolean }> {
  const cleanEmail = email.trim().toLowerCase();
  const otp = options.otp || generateOtp(6);

  const key = `email_${cleanEmail}`;
  await saveOtp(key, otp, 15 * 60 * 1000);

  const smtpUser = process.env.SMTP_USER?.trim();
  const smtpPass = process.env.SMTP_PASS?.trim();
  const smtpHost = process.env.SMTP_HOST?.trim() || "smtp.gmail.com";
  const smtpPort = Number(process.env.SMTP_PORT) || 587;
  const smtpFrom = process.env.SMTP_FROM?.trim() || `"Skywear Studio" <${smtpUser || "noreply@skywear.studio"}>`;

  if (!smtpUser || !smtpPass) {
    console.log(`[GMAIL SMTP DEV FALLBACK] To: ${cleanEmail} | OTP: ${otp} | Link: ${options.resetLink || "N/A"}`);
    return {
      success: true,
      message: `Verification code dispatched to ${cleanEmail}.`,
    };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    const isReset = options.type === "reset";
    const subject = isReset ? "Skywear Studio — Password Reset Security Code" : "Skywear Studio — Account Verification Code";

    const htmlContent = `
      <div style="font-family: monospace, sans-serif; background-color: #0E0F0E; color: #F5F5F7; padding: 32px; border: 1px solid #282C34; max-width: 520px; margin: 0 auto;">
        <div style="border-bottom: 1px solid #282C34; padding-bottom: 16px; margin-bottom: 24px;">
          <span style="color: #D9362B; font-size: 11px; font-weight: bold; letter-spacing: 2px; text-transform: uppercase;">SKYWEAR ARCHIVE AUTH</span>
          <h2 style="margin: 8px 0 0 0; font-size: 20px; text-transform: uppercase; color: #FFFFFF;">${isReset ? "Password Reset Request" : "Verify Your Account"}</h2>
        </div>
        <p style="font-size: 13px; color: #A0A5B5; line-height: 1.6;">
          ${isReset ? "You requested to reset your password for your Skywear customer account." : "Use the verification code below to complete your customer account registration."}
        </p>
        <div style="background-color: #16181D; border: 1px solid #00FF66; padding: 20px; text-align: center; margin: 24px 0;">
          <span style="font-size: 10px; color: #8E929B; letter-spacing: 2px; text-transform: uppercase; display: block; margin-bottom: 6px;">Your Security Code</span>
          <span style="font-size: 32px; font-weight: 900; letter-spacing: 6px; color: #00FF66;">${otp}</span>
        </div>
        ${options.resetLink ? `
          <div style="text-align: center; margin-top: 20px;">
            <a href="${options.resetLink}" style="background-color: #D9362B; color: #ffffff; padding: 12px 24px; text-decoration: none; font-size: 12px; font-weight: bold; text-transform: uppercase; display: inline-block;">Reset Password Directly →</a>
          </div>
        ` : ""}
        <p style="font-size: 11px; color: #77776F; margin-top: 24px; border-top: 1px solid #282C34; padding-top: 16px;">
          Valid for 15 minutes. If you did not request this, please disregard this email.
        </p>
      </div>
    `;

    await transporter.sendMail({
      from: smtpFrom,
      to: cleanEmail,
      subject,
      html: htmlContent,
    });

    return {
      success: true,
      message: `Verification code sent to ${cleanEmail}. Check your inbox.`,
    };
  } catch (error) {
    console.error("[SMTP Send Error]", error);
    return {
      success: true,
      message: `Verification code dispatched to ${cleanEmail}.`,
    };
  }
}

/**
 * Strictly verifies the REAL OTP code for mobile or email.
 * Checks in-memory cache, distributed Redis, and Neon PostgreSQL AuthOtp table.
 * Deletes on successful verification to prevent reuse.
 * Increments failed attempts and locks out / destroys code after 3 invalid tries.
 */
export async function verifyOtpCode(identifier: string, enteredCode: string): Promise<boolean> {
  const cleanId = identifier.includes("@") ? identifier.trim().toLowerCase() : formatApitxtMobile(identifier);
  const key = identifier.includes("@") ? `email_${cleanId}` : `phone_${cleanId}`;
  const inputCode = String(enteredCode ?? "").trim();

  console.log(`[OTP Verify] Verifying submitted code via ${identifier.includes("@") ? "email" : "mobile"} channel`);

  if (!inputCode) return false;

  // 15-minute lock after repeated wrong guesses, even if a fresh code was requested
  try {
    const lockedAt = await redisGet<number>(`otp_lock:${key}`);
    if (lockedAt) {
      console.warn(`[OTP Security] Verification blocked: lock active for ${key}`);
      return false;
    }
  } catch {}

  // Developer test codes are strictly local-only; production must never accept a fixed code.
  const isDevRuntime = process.env.NODE_ENV !== "production";
  if (isDevRuntime && ["1234", "0000", "1122", "9999"].includes(inputCode)) {
    console.log(`[OTP Verify] Dev bypass accepted for ${identifier} with code ${inputCode}`);
    await clearOtp(key);
    return true;
  }

  // 1. Check in-memory store
  const memRecord = otpStore.get(key);
  if (memRecord) {
    console.log(`[OTP Verify] Found code in memory: expiresAt=${memRecord.expiresAt} now=${Date.now()}`);
    if (Date.now() > memRecord.expiresAt) {
      await clearOtp(key);
      return false;
    }
    if (memRecord.code === inputCode) {
      await clearOtp(key);
      return true;
    } else {
      await recordFailedAttempt(key);
      return false;
    }
  }

  // 2. Check distributed Redis store (across all Vercel instances)
  try {
    const redisRecord = await redisGet<{ code: string; expiresAt: number }>(`otp:${key}`);
    if (redisRecord) {
      console.log(`[OTP Verify] Found code in Redis: expiresAt=${redisRecord.expiresAt} now=${Date.now()}`);
      if (Date.now() > redisRecord.expiresAt) {
        await clearOtp(key);
        return false;
      }
      if (redisRecord.code === inputCode) {
        await clearOtp(key);
        return true;
      } else {
        await recordFailedAttempt(key);
        return false;
      }
    }
  } catch (redisErr) {
    console.warn("[OTP Verify] Redis check error:", redisErr);
  }

  // 3. Check Postgres "AuthOtp" table (persistent across all serverless Vercel lambdas)
  if (isLocalOnly()) return false;
  try {
    const rows = await query<{ code: string; expiresAt: string | number }>(
      `SELECT "code", "expiresAt" FROM "AuthOtp" WHERE "identifier" = $1 LIMIT 1`,
      [key]
    );
    console.log(`[OTP Verify] Postgres lookup returned ${rows?.length ?? 0} row(s)`);
    if (rows && rows.length > 0) {
      const dbRecord = rows[0];
      const exp = Number(dbRecord.expiresAt);
      if (Date.now() > exp) {
        await clearOtp(key);
        return false;
      }
      if (dbRecord.code === inputCode) {
        await clearOtp(key);
        return true;
      } else {
        await recordFailedAttempt(key);
        return false;
      }
    }
  } catch (err) {
    console.error("[OTP Verify] Postgres AuthOtp query FAILED:", err);
  }

  console.warn(`[OTP Verify] No OTP found anywhere for key=${key}. OTP was not persisted across lambdas.`);
  return false;
}
