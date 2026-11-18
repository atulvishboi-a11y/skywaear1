"use client";

/**
 * Convert VAPID base64 string to Uint8Array required by PushManager
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function isPushNotificationSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function getPushPermission(): NotificationPermission | "unsupported" {
  if (!isPushNotificationSupported()) return "unsupported";
  return Notification.permission;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration> {
  if (!isPushNotificationSupported()) {
    throw new Error("Push notifications are not supported by this browser.");
  }
  return navigator.serviceWorker.register("/sw.js", { scope: "/" });
}

export async function getExistingPushSubscription(): Promise<PushSubscription | null> {
  if (!isPushNotificationSupported()) return null;
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

export async function subscribeToPushNotifications(options?: {
  customerId?: string;
  sendWelcome?: boolean;
}): Promise<{ success: boolean; subscription?: PushSubscription; error?: string }> {
  try {
    if (!isPushNotificationSupported()) {
      return { success: false, error: "Push notifications not supported on this device/browser" };
    }

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      return { success: false, error: "Notification permission was denied or dismissed" };
    }

    const registration = await registerServiceWorker();
    await navigator.serviceWorker.ready;

    // Get VAPID public key from env, API, or hardcoded production fallback
    const FALLBACK_VAPID = "BB39-8W_5QbZs2Ie7CeOap1LWLPi_SFKqm2VI_i_irN-pSA8bcLL5H2gIxpHyet1gewyIA3vX9RxGF7dtEyOpb8";
    let vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || FALLBACK_VAPID;
    if (!vapidPublicKey) {
      try {
        const res = await fetch("/api/push/vapid-key");
        const data = await res.json();
        vapidPublicKey = data.publicKey || FALLBACK_VAPID;
      } catch {
        vapidPublicKey = FALLBACK_VAPID;
      }
    }

    const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);

    // Subscribe browser with PushManager; replace outdated or mismatched keys
    let subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      try {
        const existingKey = subscription.options.applicationServerKey;
        if (existingKey) {
          const existingArr = new Uint8Array(existingKey);
          let mismatch = existingArr.length !== convertedVapidKey.length;
          if (!mismatch) {
            for (let i = 0; i < existingArr.length; i++) {
              if (existingArr[i] !== convertedVapidKey[i]) {
                mismatch = true;
                break;
              }
            }
          }
          if (mismatch) {
            console.warn("[web-push] Replacing outdated subscription key...");
            await subscription.unsubscribe();
            subscription = null;
          }
        }
      } catch {}
    }

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey as unknown as ArrayBuffer,
      });
    }

    // Send subscription payload to backend
    const subJSON = subscription.toJSON();
    const saveRes = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subscription: {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subJSON.keys?.p256dh,
            auth: subJSON.keys?.auth,
          },
        },
        customerId: options?.customerId,
        sendWelcome: options?.sendWelcome ?? true,
      }),
    });

    if (!saveRes.ok) {
      const errJson = await saveRes.json().catch(() => ({}));
      throw new Error(errJson.error || "Failed to register subscription on server");
    }

    return { success: true, subscription };
  } catch (err: any) {
    console.error("[web-push] Subscription error:", err);
    return { success: false, error: err?.message || String(err) };
  }
}

export async function unsubscribeFromPushNotifications(): Promise<boolean> {
  try {
    if (!isPushNotificationSupported()) return false;
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return true;

    // Remove from server
    await fetch("/api/push/unsubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    }).catch(() => {});

    // Unsubscribe in browser
    return await subscription.unsubscribe();
  } catch (err) {
    console.error("[web-push] Unsubscribe error:", err);
    return false;
  }
}
