"use client";

import React from "react";

interface TShirtMockupProps {
  colorHex: string;
  side?: "front" | "back";
  graphicType?: string;
  graphicLabel?: string;
  uploadedImageUrl?: string;
  className?: string;
  showPrintBoundary?: boolean;
}

export function GraphicRenderer({ type, color = "#ec4899", label }: { type: string; color?: string; label?: string }) {
  switch (type) {
    case "cyber_tokyo":
      return (
        <div className="flex flex-col items-center justify-center p-2 text-center select-none">
          <div className="text-[28px] font-black tracking-widest uppercase bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-400 bg-clip-text text-transparent drop-shadow-md">
            東京 2099
          </div>
          <div className="w-16 h-1 my-1 rounded-full bg-gradient-to-r from-pink-500 to-cyan-400" />
          <div className="text-[10px] tracking-[0.3em] font-mono font-bold text-cyan-300">
            NEO SHIBUYA DISTRICT
          </div>
          <svg className="w-24 h-16 mt-2 text-purple-400" viewBox="0 0 100 60" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="50,5 90,55 10,55" stroke="url(#cyberGrad)" fill="rgba(236,72,153,0.15)" />
            <circle cx="50" cy="35" r="14" stroke="#06b6d4" />
            <line x1="20" y1="45" x2="80" y2="45" stroke="#f43f5e" />
            <defs>
              <linearGradient id="cyberGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#ec4899" />
                <stop offset="100%" stopColor="#06b6d4" />
              </linearGradient>
            </defs>
          </svg>
          <div className="text-[8px] font-mono tracking-widest text-slate-300 mt-1">
            01001100 // OVERSIZED DROP
          </div>
        </div>
      );

    case "dragon_art":
      return (
        <div className="flex flex-col items-center justify-center p-2 text-center select-none">
          <div className="text-[11px] font-bold tracking-[0.25em] text-amber-400 uppercase">
            EASTERN LEGEND
          </div>
          <div className="text-[32px] font-black tracking-tighter text-amber-500">
            龍 RYŪ
          </div>
          <svg className="w-28 h-20 text-amber-400 my-1" viewBox="0 0 100 80" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M10,40 Q30,10 50,40 T90,30" stroke="#f59e0b" strokeLinecap="round" />
            <path d="M25,55 Q50,75 75,45" stroke="#ef4444" strokeLinecap="round" />
            <circle cx="50" cy="40" r="16" stroke="#fbbf24" strokeDasharray="3 3" />
            <polygon points="50,20 54,28 46,28" fill="#f59e0b" />
          </svg>
          <div className="text-[9px] font-semibold text-rose-300 tracking-wider">
            FIRE & CHERRY BLOSSOM
          </div>
        </div>
      );

    case "minimal_astral":
      return (
        <div className="flex flex-col items-center justify-center p-3 text-center select-none font-mono">
          <div className="text-[9px] tracking-[0.3em] text-sky-400 uppercase">
            SYSTEM COORDINATES
          </div>
          <div className="w-12 h-12 my-2 border border-sky-400/80 rounded-full flex items-center justify-center relative">
            <div className="w-6 h-6 border border-dashed border-sky-200 rounded-full animate-spin" style={{ animationDuration: "12s" }} />
            <div className="w-1.5 h-1.5 bg-sky-400 rounded-full absolute" />
          </div>
          <div className="text-[16px] font-bold tracking-widest text-white">
            ASTRAL // 44°
          </div>
          <div className="text-[8px] text-slate-400 tracking-widest mt-1">
            DEEP SPACE ARCHIVES
          </div>
        </div>
      );

    case "gym_berserk":
      return (
        <div className="flex flex-col items-center justify-center p-2 text-center select-none">
          <div className="text-[26px] font-black tracking-tight text-red-500 uppercase italic drop-shadow-lg">
            BERSERK
          </div>
          <div className="text-[12px] font-black tracking-[0.3em] text-white bg-red-600 px-3 py-0.5 rounded my-1">
            HEAVYWEIGHT 280
          </div>
          <svg className="w-20 h-14 text-red-500 my-1" viewBox="0 0 100 60" fill="currentColor">
            <path d="M15,20 L30,20 L35,40 L65,40 L70,20 L85,20 L80,50 L20,50 Z" />
          </svg>
          <div className="text-[8px] font-mono text-zinc-300 tracking-widest">
            FORGED IN IRON // NO DAYS OFF
          </div>
        </div>
      );

    case "cyber_skull":
      return (
        <div className="flex flex-col items-center justify-center p-2 text-center select-none">
          <div className="text-[24px] font-extrabold text-cyan-400 tracking-wider">
            TECH-NOIR
          </div>
          <svg className="w-24 h-20 text-cyan-400 my-1" viewBox="0 0 100 80" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="50" cy="35" r="22" stroke="#06b6d4" />
            <circle cx="42" cy="32" r="5" fill="#06b6d4" />
            <circle cx="58" cy="32" r="5" fill="#06b6d4" />
            <path d="M40,50 L40,65 L60,65 L60,50 Z" stroke="#38bdf8" />
            <line x1="47" y1="50" x2="47" y2="65" stroke="#38bdf8" />
            <line x1="53" y1="50" x2="53" y2="65" stroke="#38bdf8" />
          </svg>
          <div className="text-[8px] font-mono text-cyan-200 tracking-widest">
            SYNTHETIC REBELLION // 004
          </div>
        </div>
      );

    case "retro_sunset":
      return (
        <div className="flex flex-col items-center justify-center p-2 text-center select-none">
          <div className="text-[20px] font-black tracking-widest bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 bg-clip-text text-transparent">
            PACIFIC COAST
          </div>
          <div className="w-20 h-14 relative my-1 overflow-hidden flex items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-gradient-to-t from-rose-600 via-orange-500 to-amber-300" />
            <div className="absolute inset-x-0 bottom-0 h-0.5 bg-black" />
            <div className="absolute inset-x-0 bottom-2 h-0.5 bg-black" />
            <div className="absolute inset-x-0 bottom-4 h-0.5 bg-black" />
          </div>
          <div className="text-[9px] font-bold text-amber-300 tracking-[0.25em]">
            CALIFORNIA 1984
          </div>
        </div>
      );

    case "jujutsu_domain":
      return (
        <div className="flex flex-col items-center justify-center p-2 text-center select-none font-mono">
          <div className="text-[9px] tracking-[0.3em] font-bold text-purple-400 uppercase">
            CURSED TECHNIQUE
          </div>
          <div className="text-[26px] font-black tracking-tight text-white my-0.5 drop-shadow-lg">
            領域展開
          </div>
          <svg className="w-24 h-16 text-purple-400 my-1" viewBox="0 0 100 60" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="50" cy="30" r="24" stroke="#a855f7" strokeDasharray="4 2" />
            <circle cx="50" cy="30" r="14" stroke="#c084fc" />
            <polygon points="50,10 65,40 35,40" stroke="#f43f5e" />
            <line x1="20" y1="30" x2="80" y2="30" stroke="#a855f7" />
          </svg>
          <div className="text-[8px] tracking-[0.25em] text-purple-300 font-bold">
            INFINITE VOID // 呪術
          </div>
        </div>
      );

    case "titan_shingeki":
      return (
        <div className="flex flex-col items-center justify-center p-2 text-center select-none">
          <div className="text-[10px] font-bold tracking-[0.25em] text-emerald-400 uppercase">
            SURVEY CORPS // 調査兵団
          </div>
          <div className="text-[24px] font-black tracking-widest text-emerald-300 my-0.5">
            自由の翼
          </div>
          <svg className="w-24 h-16 text-emerald-400 my-1" viewBox="0 0 100 60" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M50,10 C40,25 25,30 20,48 C35,44 45,36 50,26 C55,36 65,44 80,48 C75,30 60,25 50,10 Z" fill="rgba(16,185,129,0.2)" stroke="#10b981" />
            <line x1="28" y1="20" x2="72" y2="45" stroke="#34d399" strokeWidth="1.5" />
            <line x1="28" y1="45" x2="72" y2="20" stroke="#34d399" strokeWidth="1.5" />
          </svg>
          <div className="text-[8px] font-mono tracking-widest text-emerald-200">
            WINGS OF FREEDOM // SHINGEKI
          </div>
        </div>
      );

    case "hunter_spider":
      return (
        <div className="flex flex-col items-center justify-center p-2 text-center select-none">
          <div className="text-[10px] font-bold tracking-[0.3em] text-rose-400 uppercase">
            PHANTOM TROUPE
          </div>
          <div className="text-[26px] font-black tracking-tight text-white my-0.5">
            幻影旅団 // 蜘蛛
          </div>
          <svg className="w-20 h-16 text-rose-500 my-1" viewBox="0 0 100 70" fill="none" stroke="currentColor" strokeWidth="2">
            <ellipse cx="50" cy="35" rx="10" ry="14" fill="#e11d48" stroke="#f43f5e" />
            <circle cx="50" cy="18" r="7" fill="#e11d48" stroke="#f43f5e" />
            <path d="M42,28 C30,20 20,25 15,35" stroke="#f43f5e" strokeWidth="2" />
            <path d="M58,28 C70,20 80,25 85,35" stroke="#f43f5e" strokeWidth="2" />
            <path d="M40,36 C25,36 18,44 14,55" stroke="#f43f5e" strokeWidth="2" />
            <path d="M60,36 C75,36 82,44 86,55" stroke="#f43f5e" strokeWidth="2" />
          </svg>
          <div className="text-[8px] font-mono tracking-widest text-rose-300">
            SPIDER NUMBER 04 // NEN ARCHIVE
          </div>
        </div>
      );

    case "eva_mecha":
      return (
        <div className="flex flex-col items-center justify-center p-2 text-center select-none font-mono">
          <div className="text-[9px] font-bold tracking-[0.25em] text-lime-400 uppercase">
            TEST TYPE-01 // BERSERK
          </div>
          <div className="text-[26px] font-black tracking-widest text-purple-400 my-0.5 drop-shadow-md">
            新世紀 // EVA
          </div>
          <svg className="w-24 h-16 text-purple-400 my-1" viewBox="0 0 100 60" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="50,5 85,55 15,55" stroke="#a855f7" fill="rgba(168,85,247,0.2)" />
            <line x1="50" y1="5" x2="50" y2="40" stroke="#a3e635" strokeWidth="2.5" />
            <circle cx="50" cy="35" r="8" stroke="#a3e635" fill="#581c87" />
          </svg>
          <div className="text-[8px] tracking-[0.2em] text-lime-300 font-bold">
            NERV TOKYO-3 // SYNCHRONIZATION
          </div>
        </div>
      );

    case "mono_crest":
      return (
        <div className="flex flex-col items-center justify-center p-2 text-center select-none">
          <svg className="w-16 h-16" viewBox="0 0 100 100" fill="none" stroke={color} strokeWidth="3">
            <polygon points="50,6 92,30 92,70 50,94 8,70 8,30" fill="rgba(255,255,255,0.04)" />
            <polygon points="50,24 75,38 75,64 50,78 25,64 25,38" strokeDasharray="5 4" />
            <line x1="50" y1="6" x2="50" y2="94" strokeWidth="1.5" opacity="0.5" />
            <circle cx="50" cy="51" r="7" fill={color} stroke="none" />
          </svg>
          <div className="mt-1 text-[15px] font-black tracking-[0.1em] text-white leading-tight">
            {label ?? "SKYWARE"}
          </div>
          <div className="text-[8px] font-mono tracking-[0.28em] mt-0.5" style={{ color }}>
            ORIGINAL SKYWARE ARTWORK
          </div>
        </div>
      );

    default:
      return (
        <div className="p-3 text-center">
          <div className="text-xl font-bold text-violet-400 tracking-widest">THREADCRAFT</div>
          <div className="text-xs text-slate-300 font-mono">PRINT ON DEMAND</div>
        </div>
      );
  }
}

export default function TShirtMockup({
  colorHex,
  side = "front",
  graphicType,
  graphicLabel,
  uploadedImageUrl,
  className = "w-full max-w-[420px] aspect-[4/5]",
  showPrintBoundary = false,
}: TShirtMockupProps) {
  // Determine realistic fabric shading according to shirt color
  const isDarkColor = (color: string) => {
    const c = color.substring(1);
    const rgb = parseInt(c, 16);
    const r = (rgb >> 16) & 0xff;
    const g = (rgb >> 8) & 0xff;
    const b = (rgb >> 0) & 0xff;
    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return luma < 128;
  };

  const isDark = isDarkColor(colorHex);

  return (
    <div className={`relative flex items-center justify-center ${className} select-none`}>
      {/* Ambient shadow underneath garment */}
      <div className="absolute bottom-4 w-3/4 h-8 bg-black/40 blur-xl rounded-full pointer-events-none" />

      {/* Realistic T-Shirt SVG Contour */}
      <svg
        viewBox="0 0 500 560"
        className="w-full h-full drop-shadow-2xl transition-colors duration-300"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Fabric depth linear gradient */}
          <linearGradient id="fabricShade" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#000000" stopOpacity="0.28" />
            <stop offset="18%" stopColor="#ffffff" stopOpacity="0.08" />
            <stop offset="50%" stopColor="#ffffff" stopOpacity="0.02" />
            <stop offset="82%" stopColor="#ffffff" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.32" />
          </linearGradient>

          {/* Sleeve folds gradient */}
          <linearGradient id="sleeveFoldLeft" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.35" />
          </linearGradient>
          <linearGradient id="sleeveFoldRight" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.35" />
          </linearGradient>
        </defs>

        {/* Base T-shirt Silhouette */}
        <g id="tshirt-body">
          <path
            d="M 175,60 
               C 210,85 290,85 325,60 
               L 435,115 
               C 445,120 470,165 470,200 
               L 415,225 
               C 405,205 398,185 390,175 
               L 395,500 
               C 395,515 385,520 370,520 
               L 130,520 
               C 115,520 105,515 105,500 
               L 110,175 
               C 102,185 95,205 85,225 
               L 30,200 
               C 30,165 55,120 65,115 
               Z"
            fill={colorHex}
            stroke={isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.15)"}
            strokeWidth="2.5"
            strokeLinejoin="round"
          />

          {/* Fabric Shading overlay */}
          <path
            d="M 175,60 
               C 210,85 290,85 325,60 
               L 435,115 
               C 445,120 470,165 470,200 
               L 415,225 
               C 405,205 398,185 390,175 
               L 395,500 
               C 395,515 385,520 370,520 
               L 130,520 
               C 115,520 105,515 105,500 
               L 110,175 
               C 102,185 95,205 85,225 
               L 30,200 
               C 30,165 55,120 65,115 
               Z"
            fill="url(#fabricShade)"
            pointerEvents="none"
          />

          {/* Collar Detailing */}
          {side === "front" ? (
            <g id="front-collar">
              {/* Inside back collar shadow */}
              <path
                d="M 180,62 C 215,80 285,80 320,62 C 295,95 205,95 180,62 Z"
                fill="rgba(0,0,0,0.35)"
              />
              {/* Front ribbed collar band */}
              <path
                d="M 175,60 C 210,105 290,105 325,60 C 290,95 210,95 175,60 Z"
                fill={colorHex}
                stroke={isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.2)"}
                strokeWidth="2"
              />
            </g>
          ) : (
            <g id="back-collar">
              {/* Back collar line */}
              <path
                d="M 175,60 C 215,75 285,75 325,60 C 285,68 215,68 175,60 Z"
                fill={colorHex}
                stroke={isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.2)"}
                strokeWidth="2"
              />
            </g>
          )}

          {/* Sleeve inner crease shadows */}
          <path
            d="M 110,175 C 105,190 98,210 88,223"
            stroke="rgba(0,0,0,0.3)"
            strokeWidth="2"
            fill="none"
          />
          <path
            d="M 390,175 C 395,190 402,210 412,223"
            stroke="rgba(0,0,0,0.3)"
            strokeWidth="2"
            fill="none"
          />

          {/* Bottom Hem Stitching Line */}
          <line
            x1="112"
            y1="495"
            x2="388"
            y2="495"
            stroke={isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.15)"}
            strokeDasharray="4 3"
            strokeWidth="1.5"
          />
        </g>
      </svg>

      {/* DTG PRINTING BED AREA (Centered on Chest / Back) */}
      <div
        className={`absolute top-[28%] w-[52%] h-[48%] flex flex-col items-center justify-center p-3 transition-all duration-200 ${
          showPrintBoundary ? "border-2 border-dashed border-violet-500/80 bg-violet-500/5 rounded-lg" : ""
        }`}
        style={{
          // Subtle fabric texture blend
          filter: isDark ? "contrast(1.05) brightness(1.02)" : "contrast(1.08)",
        }}
      >
        {/* Uploaded User Image (if any) */}
        {uploadedImageUrl && (
          <img
            src={uploadedImageUrl}
            alt="Custom Design"
            loading="lazy"
            decoding="async"
            className="max-w-[92%] max-h-[92%] w-auto h-auto object-contain drop-shadow-md rounded"
          />
        )}

        {/* Preset Graphic Vector (if selected and no uploaded image) */}
        {!uploadedImageUrl && graphicType && (
          <GraphicRenderer type={graphicType} label={graphicLabel} />
        )}

        {/* Indicator if print zone is completely empty */}
        {!uploadedImageUrl && !graphicType && (
          <div className="text-center p-3 text-slate-400/60 font-mono text-xs border border-dashed border-slate-700/60 rounded p-4">
            PRINT ZONE (12&quot; × 16&quot;)
            <br />
            Add a graphic
          </div>
        )}
      </div>

      {/* View Badge (Front / Back) */}
      <div className="absolute top-3 left-4 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase bg-black/60 text-slate-300 border border-white/10 backdrop-blur-md">
        {side} VIEW
      </div>
    </div>
  );
}
