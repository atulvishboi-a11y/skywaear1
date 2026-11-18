import QRCode from "qrcode";
import { HttpError } from "@/lib/http";
import type { ManualUpiConfig } from "@/lib/server/store";
import { readState } from "@/lib/server/store";

export const UPI_ID_REGEX = /^[a-zA-Z0-9.\-_]{2,100}@[a-zA-Z0-9.\-_]{2,64}$/;
export const UTR_REGEX = /^[a-zA-Z0-9]{8,30}$/;

export function validateUpiId(upiId: string): boolean {
  if (!upiId || typeof upiId !== "string") return false;
  return UPI_ID_REGEX.test(upiId.trim());
}

export function cleanUtr(raw: string): string {
  if (!raw) return "";
  let s = raw.trim();
  // Strip common bank prefixes if user copies "UPI/1234..." or "UTR: 1234..."
  s = s.replace(/^(UPI|UTR|REF|TXN|TRANSACTION|ID)[:/\s-]+/i, "");
  return s.replace(/[\s\-_/:]/g, "").toUpperCase();
}

export function validateUtr(raw: string): { valid: boolean; cleaned: string; error?: string } {
  const cleaned = cleanUtr(raw);
  if (!cleaned) {
    return { valid: false, cleaned: "", error: "Please enter your 12-digit UPI reference number (UTR)" };
  }
  if (cleaned.length < 8) {
    return { valid: false, cleaned, error: "UTR reference is too short (minimum 8 alphanumeric characters)" };
  }
  if (cleaned.length > 30) {
    return { valid: false, cleaned, error: "UTR reference is too long (maximum 30 characters)" };
  }
  if (!UTR_REGEX.test(cleaned)) {
    return { valid: false, cleaned, error: "UTR must contain only letters and numbers without spaces or symbols" };
  }
  return { valid: true, cleaned };
}

export function generateUpiUri(params: {
  upiId: string;
  merchantName: string;
  amount: number;
  orderNumber: string;
  note?: string;
}): string {
  const pa = encodeURIComponent(params.upiId.trim());
  const pn = encodeURIComponent(params.merchantName.trim());
  const am = params.amount.toFixed(2);
  const cu = "INR";
  const tn = encodeURIComponent(params.note || params.orderNumber);

  return `upi://pay?pa=${pa}&pn=${pn}&am=${am}&cu=${cu}&tn=${tn}`;
}

export async function generateQrCodeDataUrl(upiUri: string): Promise<string> {
  try {
    return await QRCode.toDataURL(upiUri, {
      width: 320,
      margin: 2,
      errorCorrectionLevel: "M",
      color: {
        dark: "#000000",
        light: "#FFFFFF",
      },
    });
  } catch (error) {
    console.error("[manualUpi] QR generation failed:", error);
    throw new HttpError(500, "Could not generate dynamic UPI QR code");
  }
}

export function getActiveManualUpiConfig(): ManualUpiConfig {
  const state = readState();
  return (
    state.manualUpi ?? {
      enabled: true,
      upiId: "skywear@upi",
      merchantName: "SKYWARE STREETWEAR",
      instructions:
        "Scan QR code using GPay, PhonePe, Paytm or BHIM. Enter your Order # in the remarks, and submit the 12-digit UTR below for verification.",
    }
  );
}
