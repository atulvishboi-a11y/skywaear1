/**
 * Customer-facing support details. The values live in the server state so the
 * storefront, the help centre and the admin desk always read one source of truth.
 * This module must stay free of server-only imports — client components use it.
 */

export interface SupportConfig {
  /** Digits only, country code included, e.g. 919876543210. */
  whatsappNumber: string;
  /** Digits only, country code included. */
  callNumber: string;
  email: string;
  hours: string;
  /** Pre-filled first line of the WhatsApp chat. */
  whatsappMessage: string;
  /** Tawk.to Property ID (e.g. 65a... or 24-character hexadecimal ID) */
  tawkPropertyId?: string;
  /** Tawk.to Widget ID (default is 'default') */
  tawkWidgetId?: string;
  /** Whether the Tawk.to widget is enabled on customer-facing storefront */
  tawkEnabled?: boolean;
}

export const DEFAULT_SUPPORT: SupportConfig = {
  whatsappNumber: "919000000000",
  callNumber: "919000000000",
  email: "support@skywear.in",
  hours: "Mon–Sat, 10:00 AM – 8:00 PM IST",
  whatsappMessage: "Hi SKYWARE support, I need help with my order",
  tawkPropertyId: process.env.NEXT_PUBLIC_TAWK_PROPERTY_ID || "6af70406e32c7e3c4bd0bb5d",
  tawkWidgetId: process.env.NEXT_PUBLIC_TAWK_WIDGET_ID || "default",
  tawkEnabled: true,
};

/** The seed value ships unassigned, so the admin desk can warn the owner. */
export function isPlaceholderWhatsApp(support: SupportConfig): boolean {
  return support.whatsappNumber === DEFAULT_SUPPORT.whatsappNumber;
}

export function digitsOnly(value: string): string {
  return (value ?? "").replace(/\D/g, "");
}

export function formatSupportPhone(digits: string): string {
  const clean = digitsOnly(digits);
  if (clean.length === 12 && clean.startsWith("91")) return `+91 ${clean.slice(2, 7)} ${clean.slice(7)}`;
  if (clean.length === 10) return `+91 ${clean.slice(0, 5)} ${clean.slice(5)}`;
  return clean ? `+${clean}` : "Number not set";
}

/** A bare 10-digit Indian mobile becomes 91 + number so wa.me and tel: links always route. */
export function toInternationalDigits(value: string): string {
  const digits = digitsOnly(value);
  return digits.length === 10 ? `91${digits}` : digits;
}

export function whatsappUrl(support: SupportConfig, message?: string): string {
  const digits = toInternationalDigits(support.whatsappNumber);
  if (!digits) return "#";
  const text = message ?? support.whatsappMessage;
  return text ? `https://wa.me/${digits}?text=${encodeURIComponent(text)}` : `https://wa.me/${digits}`;
}

export function callUrl(support: SupportConfig): string {
  const digits = toInternationalDigits(support.callNumber);
  return digits ? `tel:+${digits}` : "#";
}

export function mailUrl(support: SupportConfig, subject?: string): string {
  if (!support.email) return "#";
  return subject ? `mailto:${support.email}?subject=${encodeURIComponent(subject)}` : `mailto:${support.email}`;
}

export function getTawkDirectChatUrl(support: SupportConfig): string | null {
  const propertyId = support.tawkPropertyId?.trim() || process.env.NEXT_PUBLIC_TAWK_PROPERTY_ID?.trim();
  const widgetId = support.tawkWidgetId?.trim() || process.env.NEXT_PUBLIC_TAWK_WIDGET_ID?.trim() || "default";
  if (!propertyId) return null;
  return `https://tawk.to/chat/${propertyId}/${widgetId}`;
}
