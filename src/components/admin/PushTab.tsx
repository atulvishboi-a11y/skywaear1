"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Bell,
  BellRing,
  Send,
  Sparkles,
  RefreshCw,
  Smartphone,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Radio,
  ExternalLink,
  Users,
} from "lucide-react";
import type { AdminController } from "@/components/admin/shared";
import {
  ConsoleHero,
  Panel,
  PanelHeader,
  Pill,
  RowCard,
  AdminButton,
  TextInput,
  Field,
  TextArea,
} from "@/components/admin/ui";
import {
  isPushNotificationSupported,
  getPushPermission,
  subscribeToPushNotifications,
} from "@/lib/push-client";
import { copyText } from "@/lib/clipboard";

interface SubscriberItem {
  id: string;
  customerId?: string;
  createdAt: string;
  lastUsedAt?: string;
  userAgent?: string;
  endpointDomain: string;
}

export default function PushTab({ ctl }: { ctl: AdminController }) {
  const [subscribers, setSubscribers] = useState<SubscriberItem[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loadingSubs, setLoadingSubs] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  // Broadcast Form State
  const [title, setTitle] = useState("⚡ Midnight Drop Live!");
  const [body, setBody] = useState("New oversized streetwear restocked. Order now to get daily cashbacks!");
  const [targetUrl, setTargetUrl] = useState("/");
  const [filterCustomerId, setFilterCustomerId] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState<{
    totalSubscribers: number;
    sentCount: number;
    failedCount: number;
    cleanedCount: number;
  } | null>(null);

  // Local device testing state
  const [isTestingDevice, setIsTestingDevice] = useState(false);
  const [deviceStatus, setDeviceStatus] = useState<string | null>(null);

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "BB39-8W_5QbZs2Ie7CeOap1LWLPi_SFKqm2VI_i_irN-pSA8bcLL5H2gIxpHyet1gewyIA3vX9RxGF7dtEyOpb8";

  const fetchSubscribers = useCallback(async () => {
    setLoadingSubs(true);
    try {
      const res = await fetch("/api/admin/push/subscribers");
      if (res.ok) {
        const json = await res.json();
        setSubscribers(json.subscribers || []);
        setTotalCount(json.count || 0);
      }
    } catch (err) {
      console.error("Failed to load subscribers:", err);
    } finally {
      setLoadingSubs(false);
    }
  }, []);

  useEffect(() => {
    void fetchSubscribers();
  }, [fetchSubscribers]);

  const handleCopyVapid = () => {
    void copyText(vapidPublicKey).then((copied) => {
      if (!copied) return;
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    });
  };

  const handleTestDevice = async () => {
    setIsTestingDevice(true);
    setDeviceStatus(null);
    try {
      if (!isPushNotificationSupported()) {
        setDeviceStatus("Web Push is not supported in this browser window.");
        return;
      }

      const subRes = await subscribeToPushNotifications({
        sendWelcome: true,
      });

      if (!subRes.success) {
        setDeviceStatus(`Permission denied or error: ${subRes.error || "Check browser notification permissions"}`);
        return;
      }

      setDeviceStatus("⚡ Device subscribed! A test push notification has been fired.");
      ctl.notify("success", "Device registered & test notification dispatched!");
      void fetchSubscribers();
    } catch (err: any) {
      setDeviceStatus(`Error: ${err?.message || "Failed to test device"}`);
    } finally {
      setIsTestingDevice(false);
    }
  };

  const handleSendBroadcast = async () => {
    if (!title.trim() || !body.trim()) {
      ctl.notify("error", "Title and Body are required to broadcast a notification");
      return;
    }

    setIsSending(true);
    setBroadcastResult(null);
    try {
      const res = await fetch("/api/admin/push/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          url: targetUrl.trim() || "/",
          customerId: filterCustomerId.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Failed to broadcast");
      }

      const json = await res.json();
      setBroadcastResult(json);
      ctl.notify(
        "success",
        `Push sent! Delivered: ${json.sentCount}, Failed: ${json.failedCount}, Cleaned: ${json.cleanedCount}`
      );
      void fetchSubscribers();
    } catch (err: any) {
      ctl.notify("error", err?.message || "Failed to broadcast push notification");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <ConsoleHero
        eyebrow="RFC 8292 Standard"
        title="Web Push Notifications"
        subtitle="Official web-push delivery engine. Dispatch native lock screen & browser notifications for order tracking, drop releases, and cashback unlocks."
        accent="amber"
      />

      {/* METRIC CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Panel>
          <div className="p-4 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-mono uppercase text-[var(--adm-text-muted)]">Active Device Subscribers</div>
              <div className="text-2xl font-black font-mono text-[var(--adm-accent)] mt-1">{totalCount}</div>
            </div>
            <div className="w-10 h-10 bg-[var(--adm-accent)]/10 border border-[var(--adm-accent)]/30 flex items-center justify-center text-[var(--adm-accent)]">
              <Users className="w-5 h-5" />
            </div>
          </div>
        </Panel>

        <Panel>
          <div className="p-4 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-mono uppercase text-[var(--adm-text-muted)]">VAPID Protocol</div>
              <div className="text-sm font-bold font-mono text-[var(--adm-text)] mt-1 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[var(--adm-accent)]"></span>
                <span>Active & Compliant</span>
              </div>
            </div>
            <div className="w-10 h-10 bg-[var(--adm-warning)]/10 border border-[var(--adm-warning)]/30 flex items-center justify-center text-[var(--adm-warning)]">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>
        </Panel>

        <Panel>
          <div className="p-4 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-mono uppercase text-[var(--adm-text-muted)]">Current Browser State</div>
              <div className="text-xs font-mono text-[var(--adm-text-dim)] mt-1">
                {typeof window !== "undefined"
                  ? `${getPushPermission().toUpperCase()} permission`
                  : "Checking..."}
              </div>
            </div>
            <div className="w-10 h-10 bg-[var(--adm-info)]/10 border border-[var(--adm-info)]/30 flex items-center justify-center text-[var(--adm-info)]">
              <Radio className="w-5 h-5" />
            </div>
          </div>
        </Panel>
      </div>

      {/* BROADCAST AND TEST SUITE */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* BROADCAST FORM */}
        <Panel>
          <PanelHeader
            title="Broadcast Push Alert"
            subtitle="Send native notification to all subscribed shoppers or a targeted customer"
          />
          <div className="p-5 space-y-4">
            <Field label="Notification Title">
              <TextInput
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. 🔥 Flash Drop: 50% Cashback Today"
              />
            </Field>

            <Field label="Notification Message (Body)">
              <TextArea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write message shown on lock screen / desktop banner..."
                rows={3}
              />
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Target Destination URL" hint="Internal route (/wallet, /shop) or external URL (https://google.com)">
                <TextInput
                  value={targetUrl}
                  onChange={(e) => setTargetUrl(e.target.value)}
                  placeholder="/wallet or https://google.com"
                />
              </Field>

              <Field label="Target Customer ID (Optional)">
                <TextInput
                  value={filterCustomerId}
                  onChange={(e) => setFilterCustomerId(e.target.value)}
                  placeholder="Leave empty for all subscribers"
                />
              </Field>
            </div>

            {broadcastResult && (
              <div className="p-3 bg-[var(--adm-bg)] border border-[var(--adm-accent)]/30 text-xs font-mono space-y-1">
                <div className="text-[var(--adm-accent)] font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> Broadcast Complete
                </div>
                <div className="text-[var(--adm-text-dim)]">
                  Targeted: {broadcastResult.totalSubscribers} · Delivered: {broadcastResult.sentCount} · Failed: {broadcastResult.failedCount} · Cleaned: {broadcastResult.cleanedCount}
                </div>
              </div>
            )}

            <div className="pt-2">
              <AdminButton
                variant="primary"
                onClick={handleSendBroadcast}
                pending={isSending}
                icon={Send}
              >
                {isSending ? "Broadcasting..." : "Send Live Push Alert"}
              </AdminButton>
            </div>
          </div>
        </Panel>

        {/* DEVICE TEST & VAPID DETAILS */}
        <div className="space-y-6">
          <Panel>
            <PanelHeader
              title="Test On This Device"
              subtitle="Subscribe this admin browser session and send a sample notification"
            />
            <div className="p-5 space-y-4">
              <p className="text-xs text-[var(--adm-text-muted)] font-mono leading-relaxed">
                Clicking the button below requests standard notification permission in this browser, saves the endpoint, and immediately dispatches a real Web Push payload to test end-to-end receipt.
              </p>

              {deviceStatus && (
                <div className="p-3 bg-[var(--adm-bg)] border border-[var(--adm-border)] text-xs font-mono text-[var(--adm-text)]">
                  {deviceStatus}
                </div>
              )}

              <AdminButton
                variant="outline"
                onClick={handleTestDevice}
                pending={isTestingDevice}
                icon={BellRing}
              >
                {isTestingDevice ? "Subscribing..." : "Test Push on This Browser"}
              </AdminButton>
            </div>
          </Panel>

          <Panel>
            <PanelHeader
              title="VAPID Keys Configuration"
              subtitle="RFC 8292 standard application server identification"
            />
            <div className="p-5 space-y-3 font-mono text-xs">
              <div>
                <div className="text-[10px] text-[var(--adm-text-muted)] uppercase">Public Key (Client Safe)</div>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="text"
                    readOnly
                    value={vapidPublicKey}
                    className="w-full bg-[var(--adm-bg)] border border-[var(--adm-border)] p-2 text-[11px] text-[var(--adm-text-dim)] font-mono rounded-none"
                  />
                  <button
                    onClick={handleCopyVapid}
                    className="p-2 border border-[var(--adm-border)] bg-[var(--adm-surface)] hover:bg-[var(--adm-fill)] text-[var(--adm-text)] shrink-0"
                  >
                    {copiedKey ? <Check className="w-4 h-4 text-[var(--adm-accent)]" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="text-[11px] text-[var(--adm-text-muted)] pt-2 border-t border-[var(--adm-border)]">
                Private Key: <span className="text-[var(--adm-accent)]">Stored securely in environment variables</span>
              </div>
            </div>
          </Panel>
        </div>
      </div>

      {/* SUBSCRIBERS TABLE */}
      <Panel>
        <div className="flex items-center justify-between p-4 border-b border-[var(--adm-border)]">
          <PanelHeader
            title={`Active Browser Subscriptions (${totalCount})`}
            subtitle="Browser endpoints registered to receive web-push dispatches"
          />
          <AdminButton
            variant="outline"
            onClick={fetchSubscribers}
            pending={loadingSubs}
            icon={RefreshCw}
          >
            {loadingSubs ? "Refreshing..." : "Refresh"}
          </AdminButton>
        </div>

        <div className="p-4">
          {subscribers.length === 0 ? (
            <div className="p-8 text-center text-[var(--adm-text-muted)] font-mono text-xs">
              No push subscribers registered yet. Click &apos;Test Push on This Browser&apos; or enable alerts in the storefront.
            </div>
          ) : (
            <div className="space-y-2 font-mono text-xs">
              {subscribers.map((sub) => (
                <div
                  key={sub.id}
                  className="p-3 bg-[var(--adm-bg)] border border-[var(--adm-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[var(--adm-text)]">{sub.id}</span>
                      <Pill tone="amber">{sub.endpointDomain}</Pill>
                      {sub.customerId && (
                        <Pill tone="success">Customer: {sub.customerId}</Pill>
                      )}
                    </div>
                    <div className="text-[10px] text-[var(--adm-text-muted)] truncate max-w-lg">
                      {sub.userAgent || "Unknown Browser / OS"}
                    </div>
                  </div>
                  <div className="text-right text-[10px] text-[var(--adm-text-muted)] shrink-0">
                    <div>Subscribed: {new Date(sub.createdAt).toLocaleDateString()}</div>
                    {sub.lastUsedAt && (
                      <div>Active: {new Date(sub.lastUsedAt).toLocaleTimeString()}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
}
