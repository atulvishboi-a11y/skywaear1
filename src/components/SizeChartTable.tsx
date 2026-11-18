"use client";

import React, { useState } from "react";
import { SIZE_CHART } from "../data/products";

const ROWS = [
  { key: "chest", label: "Chest", inch: "chestInch", cm: "chestCm" },
  { key: "length", label: "Length", inch: "lengthInch", cm: "lengthCm" },
  { key: "shoulder", label: "Shoulder", inch: "shoulderInch", cm: "shoulderCm" },
] as const;

interface SizeChartTableProps {
  selectedSize?: string;
  /** Restrict the chart to the sizes this product actually sells. */
  sizes?: string[];
  className?: string;
}

export default function SizeChartTable({ selectedSize, sizes, className = "" }: SizeChartTableProps) {
  const [unit, setUnit] = useState<"inch" | "cm">("inch");
  const columns = sizes?.length
    ? SIZE_CHART.filter((column) => sizes.includes(column.size))
    : SIZE_CHART;

  return (
    <div className={className}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#8E929B]">
          {unit === "inch" ? "Inches" : "Centimetres"}
        </span>
        <div className="flex border border-[#282C34]">
          {(["inch", "cm"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setUnit(value)}
              aria-pressed={unit === value}
              className={`h-6 px-2 text-[9px] font-bold uppercase tracking-wider transition-colors ${
                unit === value ? "bg-[#F5F5F7] text-[#0B0C10]" : "text-[#8E929B] hover:text-white"
              }`}
            >
              {value === "inch" ? "in" : "cm"}
            </button>
          ))}
        </div>
      </div>

      <table className="mt-1.5 w-full border-collapse text-center">
        <thead>
          <tr className="border-b border-[#282C34]">
            <th className="py-1.5 pr-2 text-left text-[10px] font-bold uppercase tracking-[0.1em] text-[#8E929B]">
              Size
            </th>
            {columns.map((column) => (
              <th
                key={column.size}
                className={`py-1.5 text-[11px] font-bold uppercase ${
                  selectedSize === column.size ? "text-[#00FF66]" : "text-white"
                }`}
              >
                {column.size}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#22252E]">
          {ROWS.map((row) => (
            <tr key={row.key}>
              <td className="py-1.5 pr-2 text-left text-[11px] text-[#8E929B]">{row.label}</td>
              {columns.map((column) => (
                <td
                  key={column.size}
                  className={`py-1.5 text-[11px] font-bold ${
                    selectedSize === column.size ? "text-[#00FF66]" : "text-white"
                  }`}
                >
                  {column[row[unit]]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
