"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  Copy,
  Check,
  Sparkles,
  Download,
  ExternalLink,
  Layers,
  Palette,
  Type,
  Shirt,
  Compass,
  Cpu,
  Shield,
  Eye,
  Maximize2,
  Terminal,
  Grid,
} from "lucide-react";
import { toast } from "sonner";
import { copyText } from "@/lib/clipboard";

interface Swatch {
  name: string;
  role: string;
  hex: string;
  rgb: string;
  oklch: string;
  textColor: string;
  category: "core" | "neon" | "neutral";
}

const COLOR_SWATCHES: Swatch[] = [
  {
    name: "Obsidian Core",
    role: "Primary Canvas / Deep Space OLED",
    hex: "#0B0C10",
    rgb: "rgb(11, 12, 16)",
    oklch: "oklch(0.12 0.01 260)",
    textColor: "#F5F5F7",
    category: "core",
  },
  {
    name: "Carbon Surface",
    role: "Double-Bezel Hardware Card Shell",
    hex: "#16181D",
    rgb: "rgb(22, 24, 29)",
    oklch: "oklch(0.18 0.01 260)",
    textColor: "#F5F5F7",
    category: "core",
  },
  {
    name: "Kinetic Lime",
    role: "High-Voltage Accent / Instant Cashback",
    hex: "#00FF66",
    rgb: "rgb(0, 255, 102)",
    oklch: "oklch(0.86 0.28 142)",
    textColor: "#0B0C10",
    category: "neon",
  },
  {
    name: "Photonic Cyan",
    role: "Cyber Subculture / Holographic Trim",
    hex: "#00F0FF",
    rgb: "rgb(0, 240, 255)",
    oklch: "oklch(0.85 0.17 215)",
    textColor: "#0B0C10",
    category: "neon",
  },
  {
    name: "Crimson Betrayal",
    role: "Heritage Tokyo Ink / Urgency & Seals",
    hex: "#D9362B",
    rgb: "rgb(217, 54, 43)",
    oklch: "oklch(0.55 0.22 28)",
    textColor: "#F5F5F7",
    category: "neon",
  },
  {
    name: "Combed Chalk",
    role: "Pure Heavyweight Cotton / Primary Text",
    hex: "#F5F5F7",
    rgb: "rgb(245, 245, 247)",
    oklch: "oklch(0.97 0.005 260)",
    textColor: "#0B0C10",
    category: "neutral",
  },
  {
    name: "Titanium Mute",
    role: "Secondary Metadata / Micro Labels",
    hex: "#8E929B",
    rgb: "rgb(142, 146, 155)",
    oklch: "oklch(0.65 0.015 260)",
    textColor: "#0B0C10",
    category: "neutral",
  },
  {
    name: "Subtle Hairline",
    role: "Double-Bezel Border & Blueprint Grids",
    hex: "#282C34",
    rgb: "rgb(40, 44, 52)",
    oklch: "oklch(0.25 0.01 260)",
    textColor: "#F5F5F7",
    category: "neutral",
  },
];

const TYPOGRAPHY_SPECIMENS = [
  {
    role: "Headline / Mega Display",
    font: "Space Grotesk",
    weight: "Bold / 700",
    sample: "240 GSM OVERSIZED STREETWEAR",
    size: "clamp(36px, 6vw, 72px)",
    usage: "Section hero titles, campaign banners, bold drops",
  },
  {
    role: "Technical / Telemetry Monospace",
    font: "Space Mono",
    weight: "Regular & Bold / 400-700",
    sample: "AUTH_TOKEN // GSM_240 // INR_₹1,499.00 // LOT_890",
    size: "12px - 14px",
    usage: "Price tags, order codes, referral tokens, system telemetry",
  },
  {
    role: "Editorial / Reader Prose",
    font: "Work Sans",
    weight: "Medium / 500",
    sample: "Custom milled super-combed cotton, preshrunk with zero torque distortion.",
    size: "15px - 17px",
    usage: "Product storytelling, care instructions, editorial commentary",
  },
];

export default function BrandKitPage() {
  const [copiedHex, setCopiedHex] = useState<string | null>(null);
  const [logoMode, setLogoMode] = useState<"dark" | "light">("dark");
  const [activeTab, setActiveTab] = useState<"palette" | "typography" | "blueprint" | "apparel" | "voice">("palette");

  const copyToClipboard = (text: string, label: string) => {
    void copyText(text).then((copied) => {
      if (!copied) {
        toast.error("Browser blocked the clipboard — long-press the value to copy it");
        return;
      }
      setCopiedHex(text);
      toast.success(`${label} Copied!`, {
        description: text,
        duration: 2000,
      });
      setTimeout(() => setCopiedHex(null), 2200);
    });
  };

  const copyDesignTokensJson = () => {
    const tokens = {
      brand: "SKYWEAR",
      version: "4.2.0-PROD",
      curators: "Breaver Studios Inspired Identity Architecture",
      canvas: {
        background: "#0B0C10",
        surface: "#16181D",
        border: "#282C34",
      },
      accents: {
        primary: "#00FF66",
        secondary: "#00F0FF",
        danger: "#D9362B",
      },
      materials: {
        fabric: "240 GSM 100% Super-Combed Cotton",
        print: "Matte High-Density Silicone Discharge",
        fit: "Japanese Relaxed Drop-Shoulder Boxy Cut",
      },
      motion: {
        easeOut: "cubic-bezier(0.23, 1, 0.32, 1)",
        spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
        pressFeedbackMs: 120,
      },
    };
    void copyText(JSON.stringify(tokens, null, 2)).then((copied) => {
      if (copied) toast.success("All System Tokens Copied as JSON!");
      else toast.error("Browser blocked the clipboard — long-press the value to copy it");
    });
  };

  return (
    <div className="min-h-screen bg-[#0B0C10] text-[#F5F5F7] font-mono selection:bg-[#00FF66] selection:text-[#0B0C10] relative overflow-x-hidden">
      {/* Blueprint Sub-Grid Lines Overlay */}
      <div className="fixed inset-0 bg-[linear-gradient(to_right,#16181D_1px,transparent_1px),linear-gradient(to_bottom,#16181D_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_80%_60%_at_50%_40%,#000_60%,transparent_100%)] opacity-35 pointer-events-none z-0" />

      {/* Floating Glass Island Nav (Vanguard Architecture) */}
      <header className="fixed top-5 left-4 right-4 max-w-6xl mx-auto z-40">
        <div className="bg-[#16181D]/80 backdrop-blur-2xl border border-white/[0.08] rounded-full px-5 py-3 shadow-[0_12px_36px_rgba(0,0,0,0.6)] flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2.5 text-xs text-[#8E929B] hover:text-white transition-colors group"
          >
            <span className="w-7 h-7 rounded-full bg-white/[0.05] border border-white/[0.08] flex items-center justify-center group-hover:border-[#00FF66] transition-colors">
              <ArrowLeft className="w-3.5 h-3.5 text-white" />
            </span>
            <span className="tracking-widest uppercase text-[11px] font-bold hidden sm:inline">Storefront</span>
          </Link>

          <div className="flex items-center gap-2">
            <span className="text-[10px] tracking-widest uppercase bg-[#00FF66]/10 text-[#00FF66] border border-[#00FF66]/30 px-3 py-1 rounded-full font-bold flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00FF66] animate-pulse" />
              BREAVER STUDIOS SPEC // V4.2
            </span>
          </div>

          <button
            onClick={copyDesignTokensJson}
            className="group flex items-center gap-2 bg-[#00FF66] hover:bg-[#00FF66]/90 text-[#0B0C10] text-[11px] font-bold uppercase tracking-wider px-4 py-2 rounded-full transition-all duration-150 active:scale-95 shadow-[0_0_20px_rgba(0,255,102,0.3)] cursor-pointer"
          >
            <span>Tokens JSON</span>
            <span className="w-5 h-5 rounded-full bg-black/10 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Copy className="w-3 h-3 text-[#0B0C10]" />
            </span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 pt-28 pb-32 space-y-20">
        {/* ========================================================= */}
        {/* HERO SECTION: The Design Manifesto                        */}
        {/* ========================================================= */}
        <section className="space-y-8 pt-4 border-b border-[#282C34]/80 pb-16">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-[#8E929B] bg-[#16181D] px-3.5 py-1.5 rounded-full border border-[#282C34]">
              <Terminal className="w-3.5 h-3.5 text-[#00FF66]" />
              DOC_ID: BREAVER_IDENTITY_DECK_2026 // ARCHETYPE: DARK_TECH
            </div>
            <div className="text-[11px] text-[#8E929B] tracking-wider">
              CLIENT: <strong className="text-white">SKYWEAR LUXURY STREETWEAR</strong>
            </div>
          </div>

          <div className="space-y-4">
            <h1
              className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-white uppercase leading-[0.95]"
              style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}
            >
              CRAFTED FOR THE <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00FF66] via-[#00F0FF] to-white">
                DISOBEDIENT.
              </span>
            </h1>
            <p className="max-w-2xl text-sm sm:text-base text-[#8E929B] font-sans leading-relaxed">
              A comprehensive brand identity blueprint blending Japanese brutalist typography, heavyweight 240 GSM textile engineering, and cyber-minimalist digital tokens. Designed for relentless consistency across physical garments, packaging, and high-performance Web/PWA interfaces.
            </p>
          </div>

          {/* Quick Metrics Bento Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4">
            <div className="bg-[#16181D]/80 border border-[#282C34] rounded-2xl p-4">
              <span className="text-[10px] text-[#8E929B] uppercase tracking-wider block">Canvas Ratio</span>
              <span className="text-xl font-bold text-white mt-1 block">240 GSM</span>
              <span className="text-[10px] text-[#00FF66] mt-0.5 block">Heavy French Terry</span>
            </div>
            <div className="bg-[#16181D]/80 border border-[#282C34] rounded-2xl p-4">
              <span className="text-[10px] text-[#8E929B] uppercase tracking-wider block">Grid Baseline</span>
              <span className="text-xl font-bold text-white mt-1 block">8pt Fluid</span>
              <span className="text-[10px] text-[#00F0FF] mt-0.5 block">Concentric Radii</span>
            </div>
            <div className="bg-[#16181D]/80 border border-[#282C34] rounded-2xl p-4">
              <span className="text-[10px] text-[#8E929B] uppercase tracking-wider block">Color Model</span>
              <span className="text-xl font-bold text-white mt-1 block">OKLCH</span>
              <span className="text-[10px] text-white mt-0.5 block">Wide Gamut DCI-P3</span>
            </div>
            <div className="bg-[#16181D]/80 border border-[#282C34] rounded-2xl p-4">
              <span className="text-[10px] text-[#8E929B] uppercase tracking-wider block">Platform Target</span>
              <span className="text-xl font-bold text-white mt-1 block">PWA Standalone</span>
              <span className="text-[10px] text-[#00FF66] mt-0.5 block">Zero-Slop Native</span>
            </div>
          </div>
        </section>

        {/* ========================================================= */}
        {/* INTERACTIVE NAVIGATION TABS                               */}
        {/* ========================================================= */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-[#282C34] no-scrollbar">
          {[
            { id: "palette", label: "01 // Color Tokens", icon: Palette },
            { id: "typography", label: "02 // Typographic System", icon: Type },
            { id: "blueprint", label: "03 // Geometric Blueprint", icon: Grid },
            { id: "apparel", label: "04 // Apparel & Materials", icon: Shirt },
            { id: "voice", label: "05 // Brand Strategy & Voice", icon: Compass },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold tracking-wider uppercase whitespace-nowrap transition-all duration-150 cursor-pointer ${
                  active
                    ? "bg-[#00FF66] text-[#0B0C10] shadow-[0_0_20px_rgba(0,255,102,0.25)]"
                    : "bg-[#16181D] text-[#8E929B] hover:text-white border border-[#282C34]"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* ========================================================= */}
        {/* TAB 01: COLOR TOKENS (Interactive Matrix)                 */}
        {/* ========================================================= */}
        {activeTab === "palette" && (
          <section className="space-y-8 animate-in fade-in duration-300">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <span className="text-xs text-[#00FF66] font-bold tracking-widest uppercase block mb-1">
                  CHROMATIC ARCHITECTURE
                </span>
                <h2
                  className="text-2xl sm:text-3xl font-extrabold uppercase text-white"
                  style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}
                >
                  Calibrated Color System
                </h2>
                <p className="text-xs text-[#8E929B] mt-1 max-w-xl">
                  Every tone is mathematically tuned for OLED screens and pigment-matched for water-based screen printing on 240 GSM organic cotton. Tap any swatch to copy value.
                </p>
              </div>
              <div className="text-[11px] text-[#8E929B] font-mono">
                [CLICK SWATCH TO COPY HEX]
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {COLOR_SWATCHES.map((swatch) => (
                <div
                  key={swatch.name}
                  onClick={() => copyToClipboard(swatch.hex, swatch.name)}
                  className="group bg-[#16181D] border border-[#282C34] hover:border-[#00FF66]/50 rounded-2xl p-3 cursor-pointer transition-all duration-200 hover:-translate-y-1 shadow-lg relative overflow-hidden"
                >
                  {/* Color Preview Block (Double-Bezel) */}
                  <div
                    className="w-full h-36 rounded-xl border border-white/10 relative flex flex-col justify-between p-3 transition-transform duration-200 group-hover:scale-[1.01]"
                    style={{ backgroundColor: swatch.hex }}
                  >
                    <div className="flex justify-between items-center">
                      <span
                        className="text-[10px] font-mono font-bold tracking-widest uppercase px-2 py-0.5 rounded-md backdrop-blur-md"
                        style={{
                          backgroundColor: swatch.hex === "#0B0C10" || swatch.hex === "#16181D" ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.15)",
                          color: swatch.textColor,
                        }}
                      >
                        {swatch.category}
                      </span>
                      <span
                        className="w-6 h-6 rounded-full flex items-center justify-center backdrop-blur-md"
                        style={{
                          backgroundColor: swatch.hex === "#0B0C10" ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.15)",
                          color: swatch.textColor,
                        }}
                      >
                        {copiedHex === swatch.hex ? <Check className="w-3 h-3 text-[#00FF66]" /> : <Copy className="w-3 h-3" />}
                      </span>
                    </div>

                    <div className="font-mono text-sm font-black tracking-wider" style={{ color: swatch.textColor }}>
                      {swatch.hex}
                    </div>
                  </div>

                  {/* Swatch Details */}
                  <div className="p-2 space-y-1 mt-1">
                    <h4 className="text-xs font-bold text-white tracking-wide">{swatch.name}</h4>
                    <p className="text-[11px] text-[#8E929B] leading-tight">{swatch.role}</p>
                    <div className="pt-2 text-[10px] text-[#8E929B]/70 font-mono flex justify-between">
                      <span>RGB:</span>
                      <span className="text-white">{swatch.rgb}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Micro Contrast Guide Card */}
            <div className="bg-[#16181D]/90 border border-[#282C34] rounded-2xl p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <span className="text-[10px] uppercase font-bold text-[#00FF66] tracking-wider block">Rule 01: Core Canvas</span>
                <p className="text-xs text-[#8E929B] leading-relaxed">
                  Always use Obsidian <code className="text-white">#0B0C10</code> as the lowest z-index canvas. Avoid pure black <code className="text-white">#000000</code> except for deep shadow masks.
                </p>
              </div>
              <div className="space-y-2">
                <span className="text-[10px] uppercase font-bold text-[#00F0FF] tracking-wider block">Rule 02: Neon Hierarchy</span>
                <p className="text-xs text-[#8E929B] leading-relaxed">
                  Kinetic Lime <code className="text-white">#00FF66</code> is reserved strictly for primary affirmative CTAs, cash rewards, and VIP markers. Never dilute it across large backgrounds.
                </p>
              </div>
              <div className="space-y-2">
                <span className="text-[10px] uppercase font-bold text-[#D9362B] tracking-wider block">Rule 03: Crimson Anchor</span>
                <p className="text-xs text-[#8E929B] leading-relaxed">
                  Crimson Betrayal <code className="text-white">#D9362B</code> acts as the authentic Japanese hanko-seal mark and high-priority stock warnings.
                </p>
              </div>
            </div>
          </section>
        )}

        {/* ========================================================= */}
        {/* TAB 02: TYPOGRAPHIC SPECIMENS                             */}
        {/* ========================================================= */}
        {activeTab === "typography" && (
          <section className="space-y-8 animate-in fade-in duration-300">
            <div>
              <span className="text-xs text-[#00FF66] font-bold tracking-widest uppercase block mb-1">
                EDITORIAL ENGINE
              </span>
              <h2
                className="text-2xl sm:text-3xl font-extrabold uppercase text-white"
                style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}
              >
                Typographic Hierarchy
              </h2>
              <p className="text-xs text-[#8E929B] mt-1 max-w-xl">
                A high-contrast tri-font system combining wide grotesque editorial power, brutalist monospace telemetry, and clean readable grotesque prose.
              </p>
            </div>

            <div className="space-y-4">
              {TYPOGRAPHY_SPECIMENS.map((spec, i) => (
                <div
                  key={spec.role}
                  className="bg-[#16181D] border border-[#282C34] rounded-2xl p-6 sm:p-8 space-y-4 relative overflow-hidden"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 text-xs border-b border-[#282C34] pb-4">
                    <span className="text-[#00FF66] font-bold tracking-wider uppercase">
                      [SPEC_0{i + 1}] — {spec.role}
                    </span>
                    <div className="flex items-center gap-4 text-[#8E929B]">
                      <span>Family: <strong className="text-white">{spec.font}</strong></span>
                      <span>Weight: <strong className="text-white">{spec.weight}</strong></span>
                    </div>
                  </div>

                  <div className="py-2">
                    <div
                      className="text-white tracking-tight break-words"
                      style={{
                        fontFamily: spec.font === "Space Grotesk"
                          ? "var(--font-space-grotesk), sans-serif"
                          : spec.font === "Space Mono"
                          ? "var(--font-space-mono), monospace"
                          : "var(--font-work-sans), sans-serif",
                        fontSize: spec.font === "Space Grotesk" ? "clamp(24px, 4.5vw, 48px)" : spec.font === "Space Mono" ? "18px" : "16px",
                        lineHeight: 1.15,
                      }}
                    >
                      {spec.sample}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between text-xs text-[#8E929B] pt-2">
                    <span>Usage: {spec.usage}</span>
                    <span className="text-[#00F0FF] font-mono">Dynamic Scale: {spec.size}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Typeface Alphabet Strip */}
            <div className="bg-[#16181D] border border-[#282C34] rounded-2xl p-6 space-y-3">
              <span className="text-[10px] text-[#8E929B] uppercase tracking-widest block">
                FULL GLYPH METRICS // SPACE GROTESK DISPLAY
              </span>
              <p
                className="text-2xl sm:text-3xl text-white tracking-widest break-all font-bold"
                style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}
              >
                ABCDEFGHIJKLMNOPQRSTUVWXYZ 0123456789 !@#$%^&*()
              </p>
            </div>
          </section>
        )}

        {/* ========================================================= */}
        {/* TAB 03: GEOMETRIC BLUEPRINT & LOGOMARK                    */}
        {/* ========================================================= */}
        {activeTab === "blueprint" && (
          <section className="space-y-8 animate-in fade-in duration-300">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <span className="text-xs text-[#00FF66] font-bold tracking-widest uppercase block mb-1">
                  TECHNICAL BLUEPRINT
                </span>
                <h2
                  className="text-2xl sm:text-3xl font-extrabold uppercase text-white"
                  style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}
                >
                  Logomark &amp; Exclusion Zones
                </h2>
                <p className="text-xs text-[#8E929B] mt-1 max-w-xl">
                  Constructed with strict mathematical Golden Ratio proportions (1:1.618) and minimum exclusion boundaries for digital screens and heavy embroidery.
                </p>
              </div>

              {/* Light / Dark Mode Toggle */}
              <div className="inline-flex bg-[#0B0C10] p-1 rounded-xl border border-[#282C34]">
                <button
                  onClick={() => setLogoMode("dark")}
                  className={`px-3 py-1.5 text-xs font-bold uppercase rounded-lg transition-colors ${
                    logoMode === "dark" ? "bg-[#00FF66] text-[#0B0C10]" : "text-[#8E929B]"
                  }`}
                >
                  Dark Canvas
                </button>
                <button
                  onClick={() => setLogoMode("light")}
                  className={`px-3 py-1.5 text-xs font-bold uppercase rounded-lg transition-colors ${
                    logoMode === "light" ? "bg-white text-[#0B0C10]" : "text-[#8E929B]"
                  }`}
                >
                  Light Canvas
                </button>
              </div>
            </div>

            {/* Interactive Grid Canvas (Double-Bezel Hardware Frame) */}
            <div
              className={`rounded-3xl p-8 sm:p-14 border transition-colors relative overflow-hidden flex flex-col items-center justify-center min-h-[360px] ${
                logoMode === "dark"
                  ? "bg-[#0B0C10] border-[#282C34]"
                  : "bg-[#F5F5F7] border-slate-300 text-slate-900"
              }`}
            >
              {/* Technical Blueprint Measurement Lines */}
              <div className="absolute inset-0 bg-[radial-gradient(#8E929B_1px,transparent_1px)] [background-size:24px_24px] opacity-20 pointer-events-none" />
              <div className="absolute top-4 left-4 text-[10px] font-mono opacity-50">
                CLEAR_SPACE: 2X // MIN_SIZE: 24PX // VECTOR: SVG_SCALABLE
              </div>
              <div className="absolute bottom-4 right-4 text-[10px] font-mono opacity-50">
                RATIO: 1.618 // AXIS: 45° KINETIC SLANT
              </div>

              {/* Concentric Golden Ratio Circles */}
              <div className="absolute w-72 h-72 rounded-full border border-[#00FF66]/20 pointer-events-none" />
              <div className="absolute w-48 h-48 rounded-full border border-[#00F0FF]/20 pointer-events-none" />

              {/* Logo Core */}
              <div className="relative z-10 flex flex-col items-center text-center space-y-4">
                <div className="w-24 h-24 rounded-2xl bg-[#16181D] border border-white/10 flex items-center justify-center shadow-2xl overflow-hidden p-2">
                  <Image
                    src="/android-chrome-192x192.png"
                    alt="SKYWEAR Mark"
                    width={84}
                    height={84}
                    className="object-cover rounded-xl"
                  />
                </div>
                <div>
                  <h3
                    className="text-3xl sm:text-4xl font-black tracking-widest uppercase"
                    style={{
                      fontFamily: "var(--font-space-grotesk), sans-serif",
                      color: logoMode === "dark" ? "#FFFFFF" : "#0B0C10",
                    }}
                  >
                    SKYWEAR
                  </h3>
                  <p className="text-[11px] font-mono tracking-[0.3em] uppercase text-[#00FF66] mt-0.5">
                    HEAVYWEIGHT STREETWEAR APPAREL
                  </p>
                </div>
              </div>
            </div>

            {/* Logo Rules 2-Column Matrix */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-[#16181D] border border-[#282C34] rounded-2xl p-6 space-y-3">
                <span className="text-xs text-[#00FF66] font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <Check className="w-4 h-4" /> Approved Applications
                </span>
                <ul className="text-xs text-[#8E929B] space-y-2 list-disc list-inside">
                  <li>Use monochrome white wordmark over dark textile surfaces.</li>
                  <li>Use Kinetic Lime monogram icon on app launcher and mobile bottom nav.</li>
                  <li>Maintain minimum 2X clear space around wordmark on billboards and posters.</li>
                  <li>Laser-etched high-density silicone patch on garment sleeve or rear hem.</li>
                </ul>
              </div>

              <div className="bg-[#16181D] border border-[#282C34] rounded-2xl p-6 space-y-3">
                <span className="text-xs text-[#D9362B] font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <Shield className="w-4 h-4" /> Prohibited Violations
                </span>
                <ul className="text-xs text-[#8E929B] space-y-2 list-disc list-inside">
                  <li>Do not stretch, distort, or skew the typography ratio under any circumstance.</li>
                  <li>Do not use generic drop shadows or bevel emboss filters.</li>
                  <li>Do not place wordmark over low-contrast busy photographic patterns without dark scrim.</li>
                  <li>Do not alter the letter-spacing tracking from the locked -0.06em spec.</li>
                </ul>
              </div>
            </div>
          </section>
        )}

        {/* ========================================================= */}
        {/* TAB 04: APPAREL & MATERIAL SCIENCE                        */}
        {/* ========================================================= */}
        {activeTab === "apparel" && (
          <section className="space-y-8 animate-in fade-in duration-300">
            <div>
              <span className="text-xs text-[#00FF66] font-bold tracking-widest uppercase block mb-1">
                TACTILE HARDWARE
              </span>
              <h2
                className="text-2xl sm:text-3xl font-extrabold uppercase text-white"
                style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}
              >
                Textile &amp; Garment Specifications
              </h2>
              <p className="text-xs text-[#8E929B] mt-1 max-w-xl">
                Every physical Skywear piece is treated as engineered hardware. No flimsy 160 GSM blends. Heavyweight structure designed to hold its drop-shoulder silhouette for years.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-[#16181D] border border-[#282C34] rounded-2xl p-6 space-y-4">
                <span className="w-10 h-10 rounded-xl bg-[#00FF66]/10 border border-[#00FF66]/30 flex items-center justify-center text-[#00FF66]">
                  <Shirt className="w-5 h-5" />
                </span>
                <h4 className="text-base font-bold text-white uppercase">240 GSM Super-Combed</h4>
                <p className="text-xs text-[#8E929B] leading-relaxed">
                  100% long-staple organic cotton. Bio-washed and silicone softened. Zero torque twisting, pre-shrunk to retain boxy silhouette after 50+ wash cycles.
                </p>
                <div className="pt-2 border-t border-[#282C34] text-[10px] text-[#00FF66] font-mono">
                  WEAVE: SINGLE JERSEY HEAVYWEIGHT
                </div>
              </div>

              <div className="bg-[#16181D] border border-[#282C34] rounded-2xl p-6 space-y-4">
                <span className="w-10 h-10 rounded-xl bg-[#00F0FF]/10 border border-[#00F0FF]/30 flex items-center justify-center text-[#00F0FF]">
                  <Layers className="w-5 h-5" />
                </span>
                <h4 className="text-base font-bold text-white uppercase">Discharge &amp; High-Density</h4>
                <p className="text-xs text-[#8E929B] leading-relaxed">
                  Screen-printed using water-based discharge ink that penetrates the yarn fibers rather than sitting on top as plastic film. Zero hand-feel, zero sweat blocking.
                </p>
                <div className="pt-2 border-t border-[#282C34] text-[10px] text-[#00F0FF] font-mono">
                  INK: ECO-FRIENDLY NON-PLASTISOL
                </div>
              </div>

              <div className="bg-[#16181D] border border-[#282C34] rounded-2xl p-6 space-y-4">
                <span className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-white">
                  <Shield className="w-5 h-5" />
                </span>
                <h4 className="text-base font-bold text-white uppercase">Anti-Counterfeit Tag</h4>
                <p className="text-xs text-[#8E929B] leading-relaxed">
                  Every garment carries a high-definition damask woven hem label paired with an authentic NFC/QR verification tag linking directly to the digital warranty record.
                </p>
                <div className="pt-2 border-t border-[#282C34] text-[10px] text-white font-mono">
                  VERIFICATION: CRYPTOGRAPHIC QR / NFC
                </div>
              </div>
            </div>

            {/* Packaging Specification Box */}
            <div className="bg-[#16181D] border border-[#282C34] rounded-2xl p-6 sm:p-8 space-y-3">
              <span className="text-[10px] text-[#00FF66] uppercase font-bold tracking-wider">
                UNBOXING EXPERIENCE SPECIFICATION
              </span>
              <h3 className="text-lg font-bold text-white uppercase">
                Matte Black Metallic Poly-Mailer + Collectible Anime Art Cards
              </h3>
              <p className="text-xs text-[#8E929B] max-w-3xl leading-relaxed">
                Orders ship in weather-sealed, dual-adhesive re-sealable poly-mailers. Inside: tissue wrapped with matte black sticker seal, metallic foil serialized drop certificate card, and two weather-resistant die-cut vinyl laptop stickers.
              </p>
            </div>
          </section>
        )}

        {/* ========================================================= */}
        {/* TAB 05: BRAND STRATEGY & VOICE MATRIX                     */}
        {/* ========================================================= */}
        {activeTab === "voice" && (
          <section className="space-y-8 animate-in fade-in duration-300">
            <div>
              <span className="text-xs text-[#00FF66] font-bold tracking-widest uppercase block mb-1">
                STRATEGIC POSITIONING
              </span>
              <h2
                className="text-2xl sm:text-3xl font-extrabold uppercase text-white"
                style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}
              >
                Tone of Voice &amp; Brand Philosophy
              </h2>
              <p className="text-xs text-[#8E929B] mt-1 max-w-xl">
                How Skywear speaks across notifications, product copy, social feeds, and customer care. Direct, uncompromised, and builder-to-builder.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-[#16181D] border border-[#282C34] rounded-2xl p-6 space-y-3">
                <span className="text-xs text-[#00FF66] font-bold uppercase tracking-wider block">
                  Core Voice Attributes
                </span>
                <div className="space-y-3 text-xs text-[#8E929B]">
                  <div>
                    <strong className="text-white block">1. Uncompromising Craft:</strong>
                    We talk about fabric weight, yarn count, and print discharge because we actually make them. No vague luxury buzzwords.
                  </div>
                  <div>
                    <strong className="text-white block">2. Cyber-Minimalist Energy:</strong>
                    Sharp, telegraphic phrasing inspired by command-line interfaces, anime battle manga, and Japanese packaging typography.
                  </div>
                  <div>
                    <strong className="text-white block">3. Radical Customer Sovereignty:</strong>
                    100% Cashback is transparent, real, and claimable daily. No hidden asterisks or scam expiration dates.
                  </div>
                </div>
              </div>

              <div className="bg-[#16181D] border border-[#282C34] rounded-2xl p-6 space-y-3">
                <span className="text-xs text-[#00F0FF] font-bold uppercase tracking-wider block">
                  Voice Spectrum Matrix
                </span>
                <div className="space-y-2.5 text-xs text-[#8E929B]">
                  <div className="flex justify-between border-b border-[#282C34] pb-2">
                    <span>We Sound Like:</span>
                    <strong className="text-white">A high-end anime atelier studio</strong>
                  </div>
                  <div className="flex justify-between border-b border-[#282C34] pb-2">
                    <span>We Never Sound Like:</span>
                    <strong className="text-[#D9362B]">A generic dropshipping mall kiosk</strong>
                  </div>
                  <div className="flex justify-between border-b border-[#282C34] pb-2">
                    <span>Button CTAs:</span>
                    <strong className="text-white font-mono uppercase">CLAIM DROP / SECURE BAG</strong>
                  </div>
                  <div className="flex justify-between pt-1">
                    <span>Customer Greeting:</span>
                    <strong className="text-white font-mono uppercase">WELCOME TO THE CIPHER</strong>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ========================================================= */}
        {/* FOOTER: Studio Colophon & Download Assets                 */}
        {/* ========================================================= */}
        <footer className="pt-16 border-t border-[#282C34] flex flex-col sm:flex-row items-center justify-between gap-6 text-xs text-[#8E929B]">
          <div className="space-y-1 text-center sm:text-left">
            <p className="text-white font-bold tracking-wider uppercase font-mono">
              SKYWEAR BRAND IDENTITY SPECIFICATION V4.2
            </p>
            <p className="text-[11px] text-[#8E929B]">
              Engineered with the aesthetic discipline of Breaver Studios &amp; Vanguard Design.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={copyDesignTokensJson}
              className="px-4 py-2.5 rounded-xl bg-[#16181D] hover:bg-[#20242c] border border-[#282C34] text-white font-bold uppercase text-[11px] transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Copy className="w-3.5 h-3.5 text-[#00FF66]" />
              <span>Copy Tokens</span>
            </button>
            <Link
              href="/"
              className="px-4 py-2.5 rounded-xl bg-[#00FF66] hover:bg-[#00FF66]/90 text-[#0B0C10] font-bold uppercase text-[11px] transition-colors"
            >
              Back to Store
            </Link>
          </div>
        </footer>
      </main>
    </div>
  );
}

