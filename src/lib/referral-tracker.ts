"use client";

const LOCAL_STORAGE_KEY = "skywear_referral_code";
const LOCAL_STORAGE_NAME_KEY = "skywear_referrer_name";
const COOKIE_KEY = "skywear_ref";
const COOKIE_NAME_KEY = "skywear_referrer_name";

/**
 * Get cookie by name on client side
 */
function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp("(^|;\\s*)(" + name + ")=([^;]*)"));
  return match ? decodeURIComponent(match[3]) : null;
}

/**
 * Set cookie with 30-day lifetime and Lax policy
 */
function setCookie(name: string, value: string, days = 30) {
  if (typeof document === "undefined") return;
  const maxAge = days * 24 * 60 * 60;
  document.cookie = `${name}=${encodeURIComponent(value)}; max-age=${maxAge}; path=/; SameSite=Lax`;
}

/**
 * Save referral code across multiple browser storage layers
 */
export function saveReferral(code: string, referrerName?: string): void {
  if (!code || typeof window === "undefined") return;
  const cleanCode = code.trim().toUpperCase();

  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, cleanCode);
    if (referrerName?.trim()) {
      localStorage.setItem(LOCAL_STORAGE_NAME_KEY, referrerName.trim());
    }
  } catch {}

  setCookie(COOKIE_KEY, cleanCode, 30);
  if (referrerName?.trim()) {
    setCookie(COOKIE_NAME_KEY, referrerName.trim(), 30);
  }
}

/**
 * Retrieve referral code from URL, localStorage, or cookies
 */
export function getStoredReferral(): { code: string | null; name: string | null } {
  if (typeof window === "undefined") return { code: null, name: null };

  // 1. Check current URL search parameters
  try {
    const urlRef = new URLSearchParams(window.location.search).get("ref");
    if (urlRef?.trim()) {
      const code = urlRef.trim().toUpperCase();
      saveReferral(code);
      return { code, name: localStorage.getItem(LOCAL_STORAGE_NAME_KEY) || getCookie(COOKIE_NAME_KEY) };
    }
  } catch {}

  // 2. Check localStorage
  let storedCode: string | null = null;
  let storedName: string | null = null;
  try {
    storedCode = localStorage.getItem(LOCAL_STORAGE_KEY);
    storedName = localStorage.getItem(LOCAL_STORAGE_NAME_KEY);
  } catch {}

  if (storedCode?.trim()) {
    return { code: storedCode.trim().toUpperCase(), name: storedName };
  }

  // 3. Check document Cookies
  const cookieCode = getCookie(COOKIE_KEY);
  const cookieName = getCookie(COOKIE_NAME_KEY);
  if (cookieCode?.trim()) {
    const cleanCode = cookieCode.trim().toUpperCase();
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, cleanCode);
      if (cookieName) localStorage.setItem(LOCAL_STORAGE_NAME_KEY, cookieName);
    } catch {}
    return { code: cleanCode, name: cookieName };
  }

  return { code: null, name: null };
}

/**
 * Try to recover referral code from server device fingerprint (emergency fallback)
 */
export async function recoverReferralFromServer(): Promise<{ code: string | null; name: string | null }> {
  try {
    const res = await fetch("/api/referrals/fingerprint");
    if (!res.ok) return { code: null, name: null };
    const data = await res.json();
    if (data.recovered && data.code) {
      saveReferral(data.code, data.name);
      return { code: data.code, name: data.name };
    }
  } catch {}
  return { code: null, name: null };
}

/**
 * Clear stored referral code upon successful signup
 */
export function clearReferral(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    localStorage.removeItem(LOCAL_STORAGE_NAME_KEY);
  } catch {}

  if (typeof document !== "undefined") {
    document.cookie = `${COOKIE_KEY}=; max-age=0; path=/`;
    document.cookie = `${COOKIE_NAME_KEY}=; max-age=0; path=/`;
  }
}
