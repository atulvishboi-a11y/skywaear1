"use client";

import React, { useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Link from "next/link";
import { ArrowLeft, Check, Ruler, Info, ShieldCheck } from "lucide-react";

interface SizeSpec {
  size: string;
  chestInches: string;
  lengthInches: string;
  shoulderInches: string;
  sleeveInches: string;
  chestCm: string;
  lengthCm: string;
  shoulderCm: string;
  sleeveCm: string;
  recommendedWeight: string;
}

const SIZE_TABLE: SizeSpec[] = [
  {
    size: "XS",
    chestInches: '40"',
    lengthInches: '27"',
    shoulderInches: '18"',
    sleeveInches: '8.5"',
    chestCm: "102 cm",
    lengthCm: "69 cm",
    shoulderCm: "46 cm",
    sleeveCm: "22 cm",
    recommendedWeight: "45–55 kg",
  },
  {
    size: "S",
    chestInches: '42"',
    lengthInches: '28"',
    shoulderInches: '19"',
    sleeveInches: '9.0"',
    chestCm: "107 cm",
    lengthCm: "71 cm",
    shoulderCm: "48 cm",
    sleeveCm: "23 cm",
    recommendedWeight: "50–65 kg",
  },
  {
    size: "M",
    chestInches: '44"',
    lengthInches: '29"',
    shoulderInches: '20"',
    sleeveInches: '9.5"',
    chestCm: "112 cm",
    lengthCm: "74 cm",
    shoulderCm: "51 cm",
    sleeveCm: "24 cm",
    recommendedWeight: "65–75 kg",
  },
  {
    size: "L",
    chestInches: '46"',
    lengthInches: '30"',
    shoulderInches: '21"',
    sleeveInches: '10.0"',
    chestCm: "117 cm",
    lengthCm: "76 cm",
    shoulderCm: "53 cm",
    sleeveCm: "25 cm",
    recommendedWeight: "75–85 kg",
  },
  {
    size: "XL",
    chestInches: '48"',
    lengthInches: '31"',
    shoulderInches: '22"',
    sleeveInches: '10.5"',
    chestCm: "122 cm",
    lengthCm: "79 cm",
    shoulderCm: "56 cm",
    sleeveCm: "26 cm",
    recommendedWeight: "85–98 kg",
  },
  {
    size: "2XL",
    chestInches: '50"',
    lengthInches: '32"',
    shoulderInches: '23"',
    sleeveInches: '11.0"',
    chestCm: "127 cm",
    lengthCm: "81 cm",
    shoulderCm: "58 cm",
    sleeveCm: "28 cm",
    recommendedWeight: "98–115 kg",
  },
];

export default function SizeGuidePage() {
  const [unit, setUnit] = useState<"inches" | "cm">("inches");

  return (
    <div className="min-h-screen bg-[#0A0B0E] text-[#F5F5F7] font-mono flex flex-col selection:bg-[#D9362B] selection:text-white">
      <Header />
      <main className="flex-1 w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">
        <Link href="/" className="inline-flex items-center gap-2 text-xs text-[#8E929B] hover:text-white uppercase transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Storefront
        </Link>

        <div className="border-b border-white/[0.08] pb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <span className="text-[10px] text-[#D9362B] font-bold uppercase tracking-widest block mb-1">
              PROPORTIONAL FIT &amp; TAILORING SPECIFICATION
            </span>
            <h1 className="text-3xl sm:text-4xl font-bold uppercase text-white tracking-tight" style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}>
              Heavyweight Sizing Guide
            </h1>
            <p className="text-xs text-[#8E929B] mt-2">
              All Skywear garments feature an intentional boxy drop-shoulder streetwear silhouette crafted from 280 GSM French Terry.
            </p>
          </div>

          {/* Unit Toggle */}
          <div className="flex items-center border border-white/[0.08] bg-[#11131A] p-1 self-start sm:self-auto">
            <button
              onClick={() => setUnit("inches")}
              className={`px-3 py-1.5 text-xs font-mono font-bold uppercase transition-colors ${
                unit === "inches" ? "bg-[#D9362B] text-white" : "text-[#8E929B] hover:text-white"
              }`}
            >
              Inches (&quot;)
            </button>
            <button
              onClick={() => setUnit("cm")}
              className={`px-3 py-1.5 text-xs font-mono font-bold uppercase transition-colors ${
                unit === "cm" ? "bg-[#D9362B] text-white" : "text-[#8E929B] hover:text-white"
              }`}
            >
              Centimeters (cm)
            </button>
          </div>
        </div>

        {/* Exact Unisex Oversized T-Shirt Size Chart (Matching Brand Specification) */}
        <div className="bg-[#11131A] border border-white/[0.08] rounded-xl p-5 sm:p-7 shadow-2xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight" style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}>
                Unisex Oversized T-Shirt Size Chart
              </h2>
              <p className="text-xs text-[#8E929B] font-mono mt-1">
                Drop-shoulder boxy cut • 280 GSM Bio-Washed Combed Cotton
              </p>
            </div>
            <div className="flex items-center gap-2 bg-[#0A0B0E] p-1 rounded-lg border border-white/[0.08] self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setUnit("inches")}
                className={`px-3 py-1.5 rounded-md text-xs font-mono font-bold transition-all ${
                  unit === "inches" ? "bg-white text-black shadow-md" : "text-[#8E929B] hover:text-white"
                }`}
              >
                INCH
              </button>
              <button
                type="button"
                onClick={() => setUnit("cm")}
                className={`px-3 py-1.5 rounded-md text-xs font-mono font-bold transition-all ${
                  unit === "cm" ? "bg-[#00FF66] text-black shadow-md" : "text-[#8E929B] hover:text-white"
                }`}
              >
                CM
              </button>
            </div>
          </div>

          <div className="overflow-x-auto -mx-1 sm:mx-0">
            <table className="w-full text-center text-sm font-sans min-w-[500px]">
              <thead>
                <tr className="border-b border-white/[0.08] text-[#8E929B]">
                  <th className="py-3 px-3 text-left font-bold text-white text-sm">Size</th>
                  {SIZE_TABLE.map((s) => (
                    <th key={s.size} className="py-3 px-3 sm:px-5 font-bold text-white text-sm">
                      {s.size}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#21242F] font-mono text-sm">
                <tr className="hover:bg-white/[0.02] transition-colors">
                  <td className="py-3.5 px-3 text-left font-semibold text-[#B9BDCC]">
                    Chest {unit === "inches" ? "(Inch)" : "(cm)"}
                  </td>
                  {SIZE_TABLE.map((s) => (
                    <td key={s.size} className="py-3.5 px-3 sm:px-5 text-white font-bold">
                      {unit === "inches" ? s.chestInches.replace('"', "") : s.chestCm.replace(" cm", "")}
                    </td>
                  ))}
                </tr>
                <tr className="hover:bg-white/[0.02] transition-colors">
                  <td className="py-3.5 px-3 text-left font-semibold text-[#B9BDCC]">
                    Length {unit === "inches" ? "(Inch)" : "(cm)"}
                  </td>
                  {SIZE_TABLE.map((s) => (
                    <td key={s.size} className="py-3.5 px-3 sm:px-5 text-white font-bold">
                      {unit === "inches" ? s.lengthInches.replace('"', "") : s.lengthCm.replace(" cm", "")}
                    </td>
                  ))}
                </tr>
                <tr className="hover:bg-white/[0.02] transition-colors">
                  <td className="py-3.5 px-3 text-left font-semibold text-[#B9BDCC]">
                    Shoulder {unit === "inches" ? "(Inch)" : "(cm)"}
                  </td>
                  {SIZE_TABLE.map((s) => (
                    <td key={s.size} className="py-3.5 px-3 sm:px-5 text-white font-bold">
                      {unit === "inches" ? s.shoulderInches.replace('"', "") : s.shoulderCm.replace(" cm", "")}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          <div className="p-3 rounded-lg bg-[#00FF66]/10 border border-[#00FF66]/25 text-xs text-[#00FF66] flex items-center gap-2 font-sans">
            <Check className="w-4 h-4 shrink-0" />
            <span>
              <strong className="text-white">Pro Fit Tip:</strong> Fits authentic to oversized streetwear. If you prefer a standard regular fit, select 1 size down.
            </span>
          </div>
        </div>

        {/* Detailed Sizing Specifications with Weight Guide */}
        <div className="bg-[#11131A] border border-white/[0.08] overflow-x-auto">
          <div className="px-4 py-3 border-b border-white/[0.08] bg-[#0A0B0E] flex items-center justify-between">
            <span className="text-xs font-bold text-white uppercase font-sans">Complete Specification & Weight Guide</span>
            <span className="text-[10px] text-[#A5AAB8] font-mono">Viewing in {unit === "inches" ? "Inches" : "Centimeters"}</span>
          </div>
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-[#0A0B0E] text-[#A5AAB8] border-b border-white/[0.08] uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4 font-bold text-white">Size</th>
                <th className="py-3 px-4 font-bold">Chest (Circumference)</th>
                <th className="py-3 px-4 font-bold">Length</th>
                <th className="py-3 px-4 font-bold">Shoulder Drop</th>
                <th className="py-3 px-4 font-bold">Sleeve Length</th>
                <th className="py-3 px-4 font-bold text-right">Recommended Body Weight</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.08] text-[#C8C5BC]">
              {SIZE_TABLE.map((row) => (
                <tr key={row.size} className="hover:bg-[#0A0B0E]/60 transition-colors">
                  <td className="py-3.5 px-4 font-bold text-white bg-[#0A0B0E]/30">{row.size}</td>
                  <td className="py-3.5 px-4">{unit === "inches" ? row.chestInches : row.chestCm}</td>
                  <td className="py-3.5 px-4">{unit === "inches" ? row.lengthInches : row.lengthCm}</td>
                  <td className="py-3.5 px-4">{unit === "inches" ? row.shoulderInches : row.shoulderCm}</td>
                  <td className="py-3.5 px-4">{unit === "inches" ? row.sleeveInches : row.sleeveCm}</td>
                  <td className="py-3.5 px-4 text-right text-[#A5AAB8] font-bold">{row.recommendedWeight}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Fit Philosophy & How To Measure */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-[#11131A] border border-white/[0.08] p-6 space-y-3 text-xs leading-relaxed font-sans">
            <div className="flex items-center gap-2 text-white font-mono font-bold uppercase text-xs">
              <Ruler className="w-4 h-4 text-[#D9362B]" /> How To Measure Your Garment
            </div>
            <ul className="space-y-2 text-[#A5AAB8] list-disc pl-4">
              <li>
                <strong className="text-white">Chest:</strong> Measure flat across the fullest part of the chest, 1 inch below the armpit seam, then double the measurement.
              </li>
              <li>
                <strong className="text-white">Length:</strong> Measure straight down from the highest point of the shoulder seam beside the collar to the bottom hem.
              </li>
              <li>
                <strong className="text-white">Shoulder Drop:</strong> Measure straight across from one shoulder seam to the opposite seam across the back.
              </li>
              <li>
                <strong className="text-white">Sleeve:</strong> Measure from the dropped shoulder seam down to the outer cuff opening.
              </li>
            </ul>
          </div>

          <div className="bg-[#11131A] border border-white/[0.08] p-6 space-y-3 text-xs leading-relaxed font-sans">
            <div className="flex items-center gap-2 text-white font-mono font-bold uppercase text-xs">
              <Info className="w-4 h-4 text-[#00FF66]" /> Fit Recommendations
            </div>
            <p className="text-[#A5AAB8]">
              Our streetwear patterns are custom-engineered for an <strong className="text-white">authentic oversized look</strong> with dropped shoulders and a boxy torso that does not cling.
            </p>
            <div className="border border-white/[0.08] bg-[#0A0B0E] p-3 space-y-1.5 font-mono text-[11px]">
              <div className="text-white font-bold">PRO-TIP FOR SIZING:</div>
              <div className="text-[#A5AAB8]">
                • <strong className="text-[#00FF66]">For intended oversized fit:</strong> Choose your standard normal size (e.g., if you wear M, order M).
              </div>
              <div className="text-[#A5AAB8]">
                • <strong className="text-[#00F0FF]">For a regular/classic fit:</strong> Choose one size smaller than your standard size.
              </div>
            </div>
            <p className="text-[11px] text-[#8E929B]">
              Free size exchanges are supported within 7 days of delivery.
            </p>
          </div>
        </div>

        {/* CTA */}
        <div className="border border-white/[0.08] bg-[#11131A] p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-xs text-white font-mono font-bold">READY TO FIND YOUR PERFECT HEAVYWEIGHT TEE?</span>
          <Link
            href="/shop"
            className="px-5 py-2.5 bg-[#D9362B] hover:bg-[#F27A6F] text-white text-xs font-mono font-bold uppercase tracking-wider transition-colors"
          >
            Explore Live Drops
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
