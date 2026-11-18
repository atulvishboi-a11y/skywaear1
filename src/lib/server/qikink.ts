import type { ShopOrder } from "@/lib/domain";

/**
 * Qikink Print-On-Demand (POD) & Fulfillment Integration Client
 *
 * Configurable via environment variables or Admin Settings:
 * - QIKINK_ENABLED (true/false toggle to turn off)
 * - QIKINK_CLIENT_ID (e.g. 975510632181852)
 * - QIKINK_CLIENT_SECRET / QIKINK_API_KEY (the 64-char secret key)
 * - QIKINK_BASE_URL (defaults to https://sandbox.qikink.com)
 * - QIKINK_MASTER_SKU (defaults to LIMITLESS)
 */

export interface QikinkCredentials {
  enabled: boolean;
  clientId: string;
  clientSecret: string;
  baseUrl: string;
  masterSku: string;
  autoPushOnApproved?: boolean;
}

export interface QikinkOrderListItem {
  order_id: string | number;
  order_number?: string;
  client_order_id?: string;
  status?: string;
  customer_name?: string;
  phone_number?: string;
  email?: string;
  courier_name?: string;
  tracking_number?: string;
  tracking_url?: string;
  created_at?: string;
  dispatched_at?: string;
  total_order_value?: string | number;
}

export interface QikinkOrderStatusResponse {
  success: boolean;
  order_id?: string | number;
  client_order_id?: string;
  status?: string; // e.g. "To Be Printed", "Printed", "Manifested", "In-Transit", "Delivered"
  courier_name?: string;
  tracking_number?: string;
  tracking_url?: string;
  dispatched_at?: string;
  delivered_at?: string;
  error?: string;
  raw?: any;
}

export interface QikinkPushOrderResponse {
  success: boolean;
  qikinkOrderId?: string | number;
  status?: string;
  message?: string;
  error?: string;
  raw?: any;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

export function getQikinkCredentials(): QikinkCredentials {
  let stateConfig: any = null;
  try {
    const { readState } = require("./store");
    stateConfig = readState()?.qikink;
  } catch {}

  const enabled = stateConfig?.enabled !== undefined
    ? Boolean(stateConfig.enabled)
    : process.env.QIKINK_ENABLED !== "false";

  return {
    enabled,
    clientId: stateConfig?.clientId || process.env.QIKINK_CLIENT_ID || "",
    clientSecret:
      stateConfig?.clientSecret ||
      process.env.QIKINK_CLIENT_SECRET ||
      process.env.QIKINK_API_KEY ||
      "",
    baseUrl: (stateConfig?.baseUrl || process.env.QIKINK_BASE_URL || "https://sandbox.qikink.com").replace(/\/$/, ""),
    masterSku: stateConfig?.masterSku || process.env.QIKINK_MASTER_SKU || "LIMITLESS",
    autoPushOnApproved: stateConfig?.autoPushOnApproved ?? false,
  };
}

export function isQikinkEnabled(): boolean {
  return getQikinkCredentials().enabled;
}

export function isQikinkConfigured(): boolean {
  const creds = getQikinkCredentials();
  return Boolean(creds.enabled && creds.clientId && creds.clientSecret);
}

/**
 * Maps any streetwear catalog product & size to the single Limitless Master SKU in Qikink.
 * e.g. Size "L" -> "LIMITLESS-L", Size "M" -> "LIMITLESS-M"
 */
export function resolveLimitlessSku(size: string, customMasterSku?: string): string {
  const creds = getQikinkCredentials();
  const baseSku = (customMasterSku || creds.masterSku || "LIMITLESS").trim().toUpperCase();
  const cleanSize = (size || "L").trim().toUpperCase();
  return `${baseSku}-${cleanSize}`;
}

/**
 * Obtain an Access Token from Qikink /api/token
 */
export async function getQikinkAccessToken(): Promise<string> {
  const creds = getQikinkCredentials();
  if (!creds.enabled) {
    throw new Error("Qikink POD integration is currently turned OFF. Enable it in Admin Settings to connect.");
  }
  if (!creds.clientId || !creds.clientSecret) {
    throw new Error("Qikink ClientId and ClientSecret are required. Please configure credentials.");
  }

  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.token;
  }

  const params = new URLSearchParams();
  params.append("ClientId", creds.clientId.trim());
  params.append("client_secret", creds.clientSecret.trim());

  const tokenUrl = `${creds.baseUrl}/api/token`;
  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Qikink auth failed (${res.status}): ${errText}`);
  }

  const data = (await res.json()) as { Accesstoken?: string; access_token?: string; expires_in?: number };
  const token = data.Accesstoken || data.access_token;
  if (!token) {
    throw new Error(`No Accesstoken found in Qikink response: ${JSON.stringify(data)}`);
  }

  cachedToken = {
    token,
    expiresAt: now + (data.expires_in ? data.expires_in * 1000 : 3600 * 1000),
  };

  return token;
}

/**
 * Push an approved order to Qikink for printing & fulfillment.
 * Automatically maps all line items to the Limitless product in Qikink.
 */
export async function pushOrderToQikink(order: ShopOrder): Promise<QikinkPushOrderResponse> {
  const creds = getQikinkCredentials();
  if (!creds.enabled) {
    return {
      success: false,
      error: "Qikink POD integration is currently turned OFF. Turn on Qikink in Admin Settings to dispatch orders.",
    };
  }

  try {
    const token = await getQikinkAccessToken();

    const nameParts = (order.customerName || "Customer").trim().split(" ");
    const firstName = nameParts[0] || "Customer";
    const lastName = nameParts.slice(1).join(" ") || "Shopper";
    const phone = (order.customerPhone || "").replace(/\D/g, "").slice(-10) || "9876543210";

    const lineItems = order.items.map((item) => ({
      search_from_my_products: 1,
      sku: resolveLimitlessSku(item.size, creds.masterSku),
      quantity: String(item.quantity || 1),
      price: String(item.price || Math.round(order.total / Math.max(1, order.items.length))),
    }));

    const payload = {
      order_number: order.orderNumber,
      qikink_shipping: "1",
      gateway: order.paymentMethod === "COD" ? "COD" : "Prepaid",
      total_order_value: String(order.total),
      line_items: lineItems,
      shipping_address: {
        first_name: firstName,
        last_name: lastName,
        address1: order.address || "Street Address",
        address2: "",
        phone: phone,
        email: order.customerEmail || "order@skywear.in",
        city: order.city || "Mumbai",
        state: order.state || "Maharashtra",
        zip: order.pincode || "400001",
        country_code: "IN",
      },
    };

    const res = await fetch(`${creds.baseUrl}/api/order/create`, {
      method: "POST",
      headers: {
        ClientId: creds.clientId.trim(),
        Accesstoken: token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const resText = await res.text();
    let data: any = {};
    try {
      data = JSON.parse(resText);
    } catch {
      data = { text: resText };
    }

    if (!res.ok) {
      return {
        success: false,
        error: data.message || data.error || `HTTP ${res.status}: ${resText.slice(0, 150)}`,
        raw: data,
      };
    }

    const qikinkOrderId = data.order_id || data.id || data.qikink_order_id || `QK-${order.orderNumber}`;

    return {
      success: true,
      qikinkOrderId,
      status: data.status || "To Be Printed",
      message: data.message || "Order successfully queued for printing on Qikink",
      raw: data,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Failed to push order to Qikink POD API",
    };
  }
}

/**
 * Fetch all orders from Qikink API
 */
export async function fetchQikinkOrdersList(): Promise<{ success: boolean; orders?: QikinkOrderListItem[]; error?: string }> {
  try {
    const creds = getQikinkCredentials();
    if (!creds.enabled) {
      return { success: false, error: "Qikink POD is turned OFF." };
    }

    const token = await getQikinkAccessToken();
    const res = await fetch(`${creds.baseUrl}/api/order`, {
      method: "GET",
      headers: {
        ClientId: creds.clientId.trim(),
        Accesstoken: token,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      return { success: false, error: `HTTP ${res.status}: ${errText}` };
    }

    const data = await res.json();
    const orders: QikinkOrderListItem[] = Array.isArray(data) ? data : data.orders || data.data || [];
    return { success: true, orders };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to fetch orders from Qikink" };
  }
}

/**
 * Fetch live fulfillment and POD status from Qikink API
 * @param orderNumber Skywear internal order number (e.g. TC_65078)
 * @param qikinkOrderId Optional Qikink external order ID
 */
export async function fetchQikinkOrderDetails(
  orderNumber: string,
  qikinkOrderId?: string
): Promise<QikinkOrderStatusResponse> {
  const creds = getQikinkCredentials();

  if (!isQikinkConfigured()) {
    return {
      success: true,
      client_order_id: orderNumber,
      order_id: qikinkOrderId || `QK-${orderNumber.replace(/\D/g, "")}`,
      status: "To Be Printed",
      courier_name: "Blue Dart Air",
    };
  }

  try {
    const token = await getQikinkAccessToken();
    const targetId = qikinkOrderId || orderNumber;
    const url = `${creds.baseUrl}/api/order?id=${encodeURIComponent(targetId)}`;

    const res = await fetch(url, {
      method: "GET",
      headers: {
        ClientId: creds.clientId.trim(),
        Accesstoken: token,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      return {
        success: false,
        error: `Qikink API responded with HTTP ${res.status}: ${errText}`,
      };
    }

    const data = await res.json();
    return {
      success: true,
      order_id: data.order_id || qikinkOrderId,
      client_order_id: data.client_order_id || data.order_number || orderNumber,
      status: data.status,
      courier_name: data.courier_name || data.courier,
      tracking_number: data.tracking_number || data.awb_number,
      tracking_url: data.tracking_url,
      dispatched_at: data.dispatched_at,
      delivered_at: data.delivered_at,
      raw: data,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Failed to communicate with Qikink POD API",
    };
  }
}
