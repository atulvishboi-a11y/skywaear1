"use client";

import React, { useState } from "react";
import {
  MessageSquare,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Save,
  Globe,
  Smartphone,
  BookOpen,
  Headphones,
  Check,
  Sparkles,
  LifeBuoy,
  Sliders,
  Laptop,
  Radio,
  Send,
} from "lucide-react";
import type { AdminController } from "@/components/admin/shared";
import { ConsoleHero, Panel, PanelHeader, Pill, AdminButton, Field, TextInput } from "@/components/admin/ui";
import { api } from "@/lib/client";
import { getTawkDirectChatUrl, type SupportConfig } from "@/lib/support";

export default function SupportChatTab({ ctl }: { ctl: AdminController }) {
  const serverSupport = ctl.snapshot.support;
  const [overrides, setOverrides] = useState<Partial<SupportConfig>>({});

  const draft: SupportConfig = { ...serverSupport, ...overrides };
  const dirty = JSON.stringify(draft) !== JSON.stringify(serverSupport);

  const patch = (values: Partial<SupportConfig>) =>
    setOverrides((prev) => ({ ...prev, ...values }));

  const propertyId = draft.tawkPropertyId?.trim() || "";
  const widgetId = draft.tawkWidgetId?.trim() || "default";
  const isEnabled = draft.tawkEnabled !== false;
  const isConfigured = Boolean(propertyId);
  const directChatUrl = getTawkDirectChatUrl(draft);

  const handleSave = async () => {
    await ctl.run(
      "support",
      async () => {
        const saved = await api.admin.saveSupport(draft);
        setOverrides(saved);
      },
      {
        successMessage: isConfigured
          ? "Tawk.to configuration updated & live on skywear.in!"
          : "Support settings saved.",
      }
    );
  };

  // Launch dedicated popout agent window
  const openAgentPopout = () => {
    if (typeof window === "undefined") return;
    const width = 1240;
    const height = 820;
    const left = Math.max(0, (window.screen.width - width) / 2);
    const top = Math.max(0, (window.screen.height - height) / 2);
    window.open(
      "https://dashboard.tawk.to/#/chat",
      "TawkAgentDesk",
      `width=${width},height=${height},top=${top},left=${left},status=no,menubar=no,toolbar=no,location=no,resizable=yes,scrollbars=yes`
    );
  };

  return (
    <>
      <ConsoleHero
        eyebrow="Live Customer Care"
        title="Tawk.to Live Support Desk"
        subtitle="Respond to live customer chats on skywear.in via Tawk.to. Launch your live agent desk below, respond to shoppers in real-time, or reply on-the-go with mobile apps."
        icon={MessageSquare}
        accent="sky"
        stats={[
          {
            label: "Integration Status",
            value: isConfigured ? "Connected" : "Setup Required",
            sub: isConfigured ? "Property Active" : "Add Property ID",
            tone: isConfigured ? "text-[var(--adm-success)] font-bold" : "text-[var(--adm-warning)] font-bold animate-pulse",
          },
          {
            label: "Property ID",
            value: propertyId ? `${propertyId.slice(0, 10)}…` : "Not Configured",
            sub: "Unique Tawk.to site ID",
            tone: propertyId ? "text-[var(--adm-info)]" : "text-[var(--adm-text-muted)]",
          },
          {
            label: "Widget ID",
            value: widgetId,
            sub: "Active widget profile",
            tone: "text-[var(--adm-text)]",
          },
          {
            label: "Storefront Live Chat",
            value: isEnabled && isConfigured ? "Online" : "Disabled",
            sub: "Live on skywear.in",
            tone: isEnabled && isConfigured ? "text-[var(--adm-accent)]" : "text-[var(--adm-text-muted)]",
          },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={openAgentPopout}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--adm-accent)] hover:bg-[var(--adm-accent)]/80 text-[var(--adm-on-accent)] font-bold text-xs uppercase tracking-wider transition-all shadow-[0_0_20px_rgba(0,255,102,0.3)] hover:scale-105 active:scale-95 cursor-pointer font-mono"
            >
              <Headphones className="w-4 h-4" />
              <span>Launch Live Agent Desk ↗</span>
            </button>
            {directChatUrl && (
              <a
                href={directChatUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-[var(--adm-surface)] hover:bg-[var(--adm-fill)] border border-[var(--adm-border)] text-[var(--adm-text)] font-mono text-xs uppercase tracking-wider transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5 text-[var(--adm-info)]" />
                <span>Test Storefront Chat</span>
              </a>
            )}
          </div>
        }
      />

      {/* Main Agent Action Hero Banner */}
      <Panel className="border-[var(--adm-accent)]/40 bg-[var(--adm-bg)] shadow-[0_0_30px_rgba(0,255,102,0.06)]">
        <div className="p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-5 font-mono">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[var(--adm-accent)] animate-pulse" />
              <span className="text-[var(--adm-text)] font-bold uppercase tracking-wider text-sm">
                Official Tawk.to Agent Desk (Respond to Live Customer Chats)
              </span>
            </div>
            <p className="text-xs text-[var(--adm-text-dim)] leading-relaxed">
              When shoppers message on <strong>skywear.in</strong>, you respond directly through your Tawk.to Agent Console. Click below to launch your dedicated Live Chat Inbox window side-by-side with this admin panel.
            </p>
            <div className="text-[11px] text-[var(--adm-text-muted)] pt-1">
              Tip: Tawk.to blocks embedding the agent login inside an &lt;iframe&gt; for anti-clickjacking security. The dedicated popout window gives you the full, unblocked official agent experience!
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full md:w-auto shrink-0">
            <button
              type="button"
              onClick={openAgentPopout}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 bg-[var(--adm-accent)] hover:bg-[var(--adm-accent)]/90 text-[var(--adm-on-accent)] font-black text-xs uppercase tracking-widest transition-all shadow-[0_0_25px_rgba(0,255,102,0.35)] active:scale-95 cursor-pointer"
            >
              <Headphones className="w-4 h-4" />
              <span>Open Agent Desk Window</span>
            </button>
            <a
              href="https://dashboard.tawk.to/#/chat"
              target="_blank"
              rel="noreferrer"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-3 bg-[var(--adm-surface)] hover:bg-[var(--adm-fill)] border border-[var(--adm-border)] text-[var(--adm-text)] text-xs uppercase tracking-wider transition-colors"
            >
              <span>Open in New Tab</span>
              <ExternalLink className="w-3.5 h-3.5 text-[var(--adm-text-muted)]" />
            </a>
          </div>
        </div>
      </Panel>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 font-mono text-xs">
        {/* ========================================================================= */}
        {/* LEFT COLUMN: LIVE CHAT CONFIGURATION & CHANNELS (7 cols)                 */}
        {/* ========================================================================= */}
        <div className="lg:col-span-7 space-y-5">
          <Panel>
            <PanelHeader
              title="Tawk.to Site Credentials"
              subtitle="Connects skywear.in to your Tawk.to property"
              icon={Sliders}
              tone="sky"
              actions={
                <div className="flex items-center gap-2">
                  {dirty ? (
                    <Pill tone="border-[var(--adm-warning)]/35 bg-[var(--adm-warning)]/10 text-[var(--adm-warning)]">Unsaved</Pill>
                  ) : (
                    <Pill tone="border-[var(--adm-success)]/35 bg-[var(--adm-success)]/10 text-[var(--adm-success)]">In sync</Pill>
                  )}
                  <AdminButton
                    variant="ghost"
                    icon={RotateCcw}
                    disabled={!dirty}
                    onClick={() => setOverrides({})}
                  >
                    Discard
                  </AdminButton>
                  <AdminButton
                    variant="primary"
                    icon={Save}
                    disabled={!dirty}
                    pending={ctl.isPending("support")}
                    onClick={handleSave}
                  >
                    Save Changes
                  </AdminButton>
                </div>
              }
            />

            <div className="p-5 space-y-4">
              <Field
                label="Tawk.to Property ID"
                required
                hint="Your registered property on dashboard.tawk.to"
              >
                <TextInput
                  value={draft.tawkPropertyId ?? ""}
                  onChange={(e) => patch({ tawkPropertyId: e.target.value })}
                  placeholder="e.g. 6af70406e32c7e3c4bd0bb5d"
                />
              </Field>

              <Field
                label="Tawk.to Widget ID"
                required
                hint="Default widget profile"
              >
                <TextInput
                  value={draft.tawkWidgetId ?? "default"}
                  onChange={(e) => patch({ tawkWidgetId: e.target.value })}
                  placeholder="default"
                />
              </Field>

              {/* Toggle Enablement */}
              <div className="p-3.5 bg-[var(--adm-bg)] border border-[var(--adm-border)] flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="text-[var(--adm-text)] font-bold uppercase text-xs flex items-center gap-2">
                    <Globe className="w-3.5 h-3.5 text-[var(--adm-accent)]" />
                    <span>Display Chat Bubble on skywear.in</span>
                  </div>
                  <div className="text-[11px] text-[var(--adm-text-muted)]">
                    Allows shoppers on your website to start live chats with your team
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isEnabled}
                    onChange={(e) => patch({ tawkEnabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-[var(--adm-fill)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[var(--adm-knob)] after:border-[var(--adm-border)] after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--adm-accent)]"></div>
                </label>
              </div>

              {/* Direct Chat Link */}
              {directChatUrl && (
                <div className="p-3.5 bg-[var(--adm-surface)] border border-[var(--adm-border)] space-y-2">
                  <span className="text-[10px] text-[var(--adm-text-muted)] uppercase font-bold block">
                    Direct Visitor Chat URL:
                  </span>
                  <div className="flex items-center justify-between gap-2 p-2 bg-[var(--adm-bg)] border border-[var(--adm-border)] font-mono text-[11px] text-[var(--adm-info)] break-all">
                    <span>{directChatUrl}</span>
                    <a
                      href={directChatUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-2 py-1 bg-[var(--adm-fill)] hover:bg-[var(--adm-fill-strong)] text-[var(--adm-text)] uppercase text-[9px] font-bold shrink-0 transition-colors"
                    >
                      Open ↗
                    </a>
                  </div>
                </div>
              )}
            </div>
          </Panel>

          {/* How Live Chat Communication Works */}
          <Panel>
            <PanelHeader
              title="How Live Chat Communication Works"
              subtitle="Two-way real-time connection between shoppers & support desk"
              icon={Radio}
              tone="sky"
            />
            <div className="p-5 space-y-3.5 text-xs text-[var(--adm-text-dim)] leading-relaxed">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono">
                <div className="p-3.5 bg-[var(--adm-bg)] border border-[var(--adm-border)] space-y-1.5">
                  <div className="font-bold text-[var(--adm-accent)] uppercase text-[11px] flex items-center gap-1.5">
                    <span>1. Shopper Experience</span>
                  </div>
                  <p className="text-[11px] text-[var(--adm-text-muted)]">
                    Visitor browses <strong>skywear.in</strong>, taps the live chat bubble, and sends a query (order tracking, sizing, cashback).
                  </p>
                </div>

                <div className="p-3.5 bg-[var(--adm-bg)] border border-[var(--adm-border)] space-y-1.5">
                  <div className="font-bold text-[var(--adm-info)] uppercase text-[11px] flex items-center gap-1.5">
                    <span>2. Admin Response Desk</span>
                  </div>
                  <p className="text-[11px] text-[var(--adm-text-muted)]">
                    You receive an audio chime and notification in your <strong>Tawk.to Agent Desk</strong> or mobile app, and reply directly!
                  </p>
                </div>
              </div>

              <div className="p-3 bg-[var(--adm-surface)] border border-[var(--adm-border)] text-[11px] space-y-1">
                <strong className="text-[var(--adm-text)]">Why not an &lt;iframe&gt; for the agent login?</strong>
                <p className="text-[var(--adm-text-muted)]">
                  Per Tawk.to official internet documentation, their server sets <code>X-Frame-Options: SAMEORIGIN</code> to prevent third-party websites from framing the login screen (clickjacking protection). The dedicated popout window or desktop app is the officially recommended, seamless workflow.
                </p>
              </div>
            </div>
          </Panel>
        </div>

        {/* ========================================================================= */}
        {/* RIGHT COLUMN: AGENT APPS, DESKTOP DOWNLOADS & DATA SYNC (5 cols)         */}
        {/* ========================================================================= */}
        <div className="lg:col-span-5 space-y-5">
          {/* Quick Agent Actions */}
          <Panel>
            <PanelHeader
              title="Agent Navigation Links"
              subtitle="Direct shortcuts into your Tawk.to dashboard"
              icon={Headphones}
              tone="sky"
            />
            <div className="p-4 space-y-2.5">
              <button
                type="button"
                onClick={openAgentPopout}
                className="w-full flex items-center justify-between p-3 bg-[var(--adm-surface)] hover:bg-[var(--adm-fill)] border border-[var(--adm-accent)]/40 text-[var(--adm-text)] font-bold transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Headphones className="w-4 h-4 text-[var(--adm-accent)]" />
                  <span>Launch Live Agent Desk (Popup)</span>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-[var(--adm-accent)]" />
              </button>

              <a
                href="https://dashboard.tawk.to/#/chat"
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between p-3 bg-[var(--adm-surface)] hover:bg-[var(--adm-fill)] border border-[var(--adm-border)] text-[var(--adm-text)] font-bold transition-colors"
              >
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-[var(--adm-info)]" />
                  <span>Incoming Chats Inbox</span>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-[var(--adm-text-muted)]" />
              </a>

              <a
                href="https://dashboard.tawk.to/#/monitoring"
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between p-3 bg-[var(--adm-surface)] hover:bg-[var(--adm-fill)] border border-[var(--adm-border)] text-[var(--adm-text)] font-bold transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-[var(--adm-warning)]" />
                  <span>Live Visitor Monitor</span>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-[var(--adm-text-muted)]" />
              </a>

              <a
                href="https://dashboard.tawk.to/#/admin"
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between p-3 bg-[var(--adm-surface)] hover:bg-[var(--adm-fill)] border border-[var(--adm-border)] text-[var(--adm-text)] font-bold transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-[var(--adm-violet)]" />
                  <span>Tawk.to Administration</span>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-[var(--adm-text-muted)]" />
              </a>
            </div>
          </Panel>

          {/* Desktop & Mobile Apps */}
          <Panel>
            <PanelHeader
              title="Official Apps (Always Online)"
              subtitle="Answer chats with notifications on PC & mobile"
              icon={Laptop}
              tone="sky"
            />
            <div className="p-4 space-y-3">
              <p className="text-[11px] text-[var(--adm-text-dim)] leading-relaxed">
                Install the official Tawk.to app to receive desktop rings and mobile notifications when a shopper is waiting:
              </p>

              <div className="space-y-2">
                <a
                  href="https://www.tawk.to/downloads/"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between p-2.5 bg-[var(--adm-bg)] hover:bg-[var(--adm-surface)] border border-[var(--adm-border)] transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Laptop className="w-4 h-4 text-[var(--adm-accent)]" />
                    <span className="font-bold text-[var(--adm-text)] text-xs">Windows & Mac Desktop App</span>
                  </div>
                  <span className="text-[10px] text-[var(--adm-accent)] uppercase font-bold">Download ↗</span>
                </a>

                <div className="grid grid-cols-2 gap-2">
                  <a
                    href="https://apps.apple.com/app/tawk-to/id907025601"
                    target="_blank"
                    rel="noreferrer"
                    className="p-2.5 bg-[var(--adm-bg)] hover:bg-[var(--adm-surface)] border border-[var(--adm-border)] text-center space-y-0.5 transition-colors block"
                  >
                    <span className="text-[9px] text-[var(--adm-text-muted)] uppercase font-bold block">Apple iOS</span>
                    <span className="text-xs font-bold text-[var(--adm-text)] flex items-center justify-center gap-1">
                      <span>App Store</span>
                      <ExternalLink className="w-3 h-3 text-[var(--adm-accent)]" />
                    </span>
                  </a>

                  <a
                    href="https://play.google.com/store/apps/details?id=to.tawk.android"
                    target="_blank"
                    rel="noreferrer"
                    className="p-2.5 bg-[var(--adm-bg)] hover:bg-[var(--adm-surface)] border border-[var(--adm-border)] text-center space-y-0.5 transition-colors block"
                  >
                    <span className="text-[9px] text-[var(--adm-text-muted)] uppercase font-bold block">Google Android</span>
                    <span className="text-xs font-bold text-[var(--adm-text)] flex items-center justify-center gap-1">
                      <span>Play Store</span>
                      <ExternalLink className="w-3 h-3 text-[var(--adm-accent)]" />
                    </span>
                  </a>
                </div>
              </div>
            </div>
          </Panel>

          {/* Visitor Sync Documentation Card */}
          <Panel>
            <PanelHeader
              title="Verified Customer Data Sync"
              subtitle="Automatically sent to your Tawk.to desk"
              icon={ShieldCheck}
              tone="sky"
            />
            <div className="p-4 space-y-2 text-[11px] text-[var(--adm-text-dim)] leading-relaxed">
              <p>
                When a logged-in Skywear customer opens live chat, our frontend automatically injects their identity into your Tawk.to agent dashboard:
              </p>
              <div className="p-2.5 bg-[var(--adm-bg)] border border-[var(--adm-border)] font-mono text-[10px] text-[var(--adm-accent)] space-y-1">
                <div>• name: customer.name</div>
                <div>• email: customer.email</div>
                <div>• phone: customer.phone</div>
                <div>• customerId: customer.id</div>
                <div>• tier: customer.tier</div>
                <div>• availableCoins: customer.availableCoins</div>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
