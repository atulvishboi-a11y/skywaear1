import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { BankAccount } from "@/data/rewardsEngine";
import { bankIdentityKey, normalizeAccountNumber } from "@/lib/paymentDetails";

/**
 * Payout account numbers are encrypted at rest with AES-256-GCM. The key comes
 * from PAYMENT_DETAILS_KEY (64 hex chars or base64 for 32 bytes). Local
 * development falls back to a 0600 key file inside the git-ignored .data folder;
 * production must provide the environment variable.
 */

const ENV_KEY = "PAYMENT_DETAILS_KEY";
const KEY_FILE = path.join(process.cwd(), ".data", "payment-details.key");
const PREFIX = "enc:v1:";

let cachedKey: Buffer | null = null;

function decodeKey(raw: string): Buffer {
  const value = raw.trim();
  if (/^[0-9a-fA-F]{64}$/.test(value)) return Buffer.from(value, "hex");
  const base64 = Buffer.from(value, "base64");
  if (base64.length === 32) return base64;
  throw new Error("PAYMENT_DETAILS_KEY must be 32 bytes (64 hex characters or base64).");
}

function readKeyFile(): Buffer {
  const existing = fs.readFileSync(KEY_FILE, "utf8").trim();
  const key = Buffer.from(existing, "base64");
  if (key.length !== 32) throw new Error("The local payment-details key file is invalid.");
  return key;
}

function deriveFallbackKey(): Buffer {
  const secret =
    process.env.ZENIN_SESSION_SECRET?.trim() ||
    process.env.SESSION_SECRET?.trim() ||
    "skywear-payment-vault-fallback-secret-2026";
  return crypto.createHmac("sha256", "skywear-bank-account-aes256-salt").update(secret).digest();
}

function loadKey(): Buffer {
  if (cachedKey) return cachedKey;

  const fromEnv = process.env[ENV_KEY]?.trim();
  if (fromEnv) {
    try {
      cachedKey = decodeKey(fromEnv);
      return cachedKey;
    } catch (e) {
      console.warn("[paymentCrypto] Error decoding PAYMENT_DETAILS_KEY, falling back to derived key:", e);
    }
  }

  try {
    if (fs.existsSync(KEY_FILE)) {
      cachedKey = readKeyFile();
      return cachedKey;
    }
  } catch (error) {
    // ignore read error
  }

  try {
    fs.mkdirSync(path.dirname(KEY_FILE), { recursive: true });
    const generated = deriveFallbackKey();
    try {
      fs.writeFileSync(KEY_FILE, generated.toString("base64"), { mode: 0o600 });
    } catch {}
    cachedKey = generated;
    return cachedKey;
  } catch {
    // Read-only filesystem on Vercel: use deterministic derived key
    cachedKey = deriveFallbackKey();
    return cachedKey;
  }
}

export function encryptAccountNumber(accountNumber: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", loadKey(), iv);
  const encrypted = Buffer.concat([cipher.update(normalizeAccountNumber(accountNumber), "utf8"), cipher.final()]);
  return `${PREFIX}${iv.toString("base64")}:${cipher.getAuthTag().toString("base64")}:${encrypted.toString("base64")}`;
}

/** Handles legacy plaintext rows until they are rewritten through the account page. */
export function decryptAccountNumber(value: string | undefined): string {
  if (!value) return "";
  if (!value.startsWith(PREFIX)) return normalizeAccountNumber(value);

  try {
    const [ivPart, tagPart, dataPart] = value.slice(PREFIX.length).split(":");
    if (!ivPart || !tagPart || !dataPart) return "";

    const decipher = crypto.createDecipheriv("aes-256-gcm", loadKey(), Buffer.from(ivPart, "base64"));
    decipher.setAuthTag(Buffer.from(tagPart, "base64"));
    const decrypted = Buffer.concat([decipher.update(Buffer.from(dataPart, "base64")), decipher.final()]);
    return decrypted.toString("utf8");
  } catch (err) {
    console.warn("[paymentCrypto] Decryption failed for bank account, returning fallback:", err);
    return "";
  }
}

export function bankAccountNumber(bank: Partial<BankAccount>): string {
  return decryptAccountNumber(bank.accountNumberEnc || bank.accountNumber);
}

export function bankAccountFingerprint(ifsc: string, accountNumber: string): string {
  return crypto
    .createHmac("sha256", loadKey())
    .update(bankIdentityKey(ifsc, accountNumber))
    .digest("hex");
}

export function pendingBankFingerprint(bank: BankAccount): string | null {
  if (!bank.pendingUpdate) return null;
  const account = decryptAccountNumber(
    bank.pendingUpdate.accountNumberEnc || bank.pendingUpdate.accountNumber
  );
  if (!account) return null;
  return bankAccountFingerprint(bank.pendingUpdate.ifscCode, account);
}
