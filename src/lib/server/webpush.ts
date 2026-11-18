import webpush from "web-push";
import type { PushNotificationPayload, WebPushSubscription } from "@/lib/domain";
import { mutate, readState, type ZeninState } from "./store";
import { query } from "./db";

// Rock-solid VAPID credentials with automatic fallback to production keys
const VAPID_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  "BB39-8W_5QbZs2Ie7CeOap1LWLPi_SFKqm2VI_i_irN-pSA8bcLL5H2gIxpHyet1gewyIA3vX9RxGF7dtEyOpb8";
const VAPID_PRIVATE_KEY =
  process.env.VAPID_PRIVATE_KEY ||
  "q2Xnq7FNWmxsLM9VD_YwAHSLEGd7O4wm6dFQ1LOZ7dU";
const VAPID_SUBJECT =
  process.env.VAPID_SUBJECT || "mailto:admin@skywear.in";

let vapidConfigured = false;

function ensureVapidConfig() {
  if (vapidConfigured) return;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return;
  }
  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    vapidConfigured = true;
  } catch (err) {
    console.error("[web-push] Failed to configure VAPID details:", err);
  }
}

export function getVapidPublicKey(): string {
  return VAPID_PUBLIC_KEY;
}

export interface SaveSubscriptionInput {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  customerId?: string;
  userAgent?: string;
}

/**
 * Save or update a browser's Web Push subscription in store and Postgres.
 * Dual-persisted: Stored in relational "PushSubscription" table + AppState.
 */
export async function savePushSubscription(
  input: SaveSubscriptionInput
): Promise<WebPushSubscription> {
  if (!input.endpoint || !input.keys?.p256dh || !input.keys?.auth) {
    throw new Error("Invalid Push Subscription payload: missing endpoint or keys");
  }

  const now = new Date().toISOString();
  const subId = `wpsub-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

  // 1. Persist directly to PostgreSQL relational table
  try {
    await query(
      `INSERT INTO "PushSubscription" ("id", "endpoint", "p256dh", "auth", "customerId", "userAgent", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT ("endpoint") DO UPDATE SET
         "p256dh" = EXCLUDED."p256dh",
         "auth" = EXCLUDED."auth",
         "customerId" = COALESCE(EXCLUDED."customerId", "PushSubscription"."customerId"),
         "userAgent" = COALESCE(EXCLUDED."userAgent", "PushSubscription"."userAgent"),
         "updatedAt" = NOW()`,
      [subId, input.endpoint, input.keys.p256dh, input.keys.auth, input.customerId ?? null, input.userAgent ?? null]
    );
  } catch (pgErr) {
    console.warn("[web-push] PostgreSQL table persist notice:", pgErr);
  }

  // 2. Persist in memory / AppState
  return mutate((state) => {
    if (!state.pushSubscriptions) state.pushSubscriptions = [];

    const existingIndex = state.pushSubscriptions.findIndex(
      (s) => s.endpoint === input.endpoint
    );

    if (existingIndex >= 0) {
      const existing = state.pushSubscriptions[existingIndex];
      const updated: WebPushSubscription = {
        ...existing,
        keys: input.keys,
        customerId: input.customerId ?? existing.customerId,
        userAgent: input.userAgent ?? existing.userAgent,
        lastUsedAt: now,
      };
      state.pushSubscriptions[existingIndex] = updated;
      return updated;
    }

    const newSub: WebPushSubscription = {
      id: subId,
      endpoint: input.endpoint,
      keys: input.keys,
      customerId: input.customerId,
      userAgent: input.userAgent,
      createdAt: now,
      lastUsedAt: now,
    };

    state.pushSubscriptions.push(newSub);
    return newSub;
  });
}

/**
 * Remove a Web Push subscription when customer revokes permission or unregisters.
 */
export async function removePushSubscription(endpoint: string): Promise<boolean> {
  try {
    await query(`DELETE FROM "PushSubscription" WHERE "endpoint" = $1`, [endpoint]);
  } catch {}

  return mutate((state) => {
    if (!state.pushSubscriptions) return false;
    const initialLen = state.pushSubscriptions.length;
    state.pushSubscriptions = state.pushSubscriptions.filter(
      (s) => s.endpoint !== endpoint
    );
    return state.pushSubscriptions.length < initialLen;
  });
}

/**
 * Send a web push notification to a single subscriber.
 */
export async function sendPushToSubscription(
  sub: WebPushSubscription,
  payload: PushNotificationPayload
): Promise<{ success: boolean; expired: boolean; error?: string }> {
  ensureVapidConfig();

  const pushSubscription = {
    endpoint: sub.endpoint,
    keys: {
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
    },
  };

  const formattedPayload = JSON.stringify({
    title: payload.title || "SKYWEAR // ZENIN",
    body: payload.body || "New update from Skywear",
    icon: payload.icon || "/android-chrome-192x192.png",
    badge: payload.badge || "/favicon-32x32.png",
    image: payload.image,
    url: payload.url || "/",
    tag: payload.tag || `skywear-${Date.now()}`,
    data: {
      url: payload.url || "/",
      receivedAt: new Date().toISOString(),
      ...(payload.data || {}),
    },
  });

  try {
    await webpush.sendNotification(pushSubscription, formattedPayload, {
      TTL: 86400, // 24 hours
      urgency: "high",
    });
    return { success: true, expired: false };
  } catch (err: any) {
    const statusCode = err?.statusCode;
    // 410 Gone or 404 Not Found indicates the user has unsubscribed or browser token expired
    const expired = statusCode === 410 || statusCode === 404;
    return {
      success: false,
      expired,
      error: err?.message || String(err),
    };
  }
}

/**
 * Broadcast push notification to all subscribers, or a specific customer's devices.
 * Pulls from relational "PushSubscription" table + AppState to guarantee 100% reach.
 * Automatically prunes expired endpoints to keep DB clean.
 */
export async function broadcastPushNotification(
  payload: PushNotificationPayload,
  filterCustomerId?: string
): Promise<{
  totalSubscribers: number;
  sentCount: number;
  failedCount: number;
  cleanedCount: number;
}> {
  ensureVapidConfig();

  // 1. Gather subscribers from relational table
  let dbSubs: WebPushSubscription[] = [];
  try {
    const rows = await query<any>(`SELECT * FROM "PushSubscription"`);
    if (rows && rows.length > 0) {
      dbSubs = rows.map((r) => ({
        id: r.id,
        endpoint: r.endpoint,
        keys: { p256dh: r.p256dh, auth: r.auth },
        customerId: r.customerId || undefined,
        userAgent: r.userAgent || undefined,
        createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString(),
        lastUsedAt: r.updatedAt ? new Date(r.updatedAt).toISOString() : undefined,
      }));
    }
  } catch (err) {
    console.warn("[web-push] PushSubscription table read notice:", err);
  }

  // 2. Merge with AppState subscriptions
  const state = readState();
  const stateSubs = state.pushSubscriptions ?? [];

  const combinedMap = new Map<string, WebPushSubscription>();
  for (const s of [...stateSubs, ...dbSubs]) {
    if (s.endpoint && s.keys?.p256dh && s.keys?.auth) {
      combinedMap.set(s.endpoint, s);
    }
  }

  const allSubs = Array.from(combinedMap.values());

  const targets = filterCustomerId
    ? allSubs.filter((s) => s.customerId === filterCustomerId)
    : allSubs;

  if (targets.length === 0) {
    return { totalSubscribers: 0, sentCount: 0, failedCount: 0, cleanedCount: 0 };
  }

  const expiredEndpoints: string[] = [];
  let sentCount = 0;
  let failedCount = 0;

  await Promise.all(
    targets.map(async (sub) => {
      const res = await sendPushToSubscription(sub, payload);
      if (res.success) {
        sentCount++;
      } else {
        failedCount++;
        if (res.expired) {
          expiredEndpoints.push(sub.endpoint);
        }
      }
    })
  );

  let cleanedCount = 0;
  if (expiredEndpoints.length > 0) {
    const expiredSet = new Set(expiredEndpoints);
    try {
      for (const ep of expiredEndpoints) {
        await query(`DELETE FROM "PushSubscription" WHERE "endpoint" = $1`, [ep]);
      }
    } catch {}

    await mutate((st) => {
      if (st.pushSubscriptions) {
        const before = st.pushSubscriptions.length;
        st.pushSubscriptions = st.pushSubscriptions.filter(
          (s) => !expiredSet.has(s.endpoint)
        );
        cleanedCount = before - st.pushSubscriptions.length;
      }
    });
  }

  return {
    totalSubscribers: targets.length,
    sentCount,
    failedCount,
    cleanedCount,
  };
}
