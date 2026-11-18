import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-md px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider transition-colors focus:outline-none select-none",
  {
    variants: {
      variant: {
        default:
          "bg-white text-black shadow-sm",
        secondary:
          "bg-[#1A1D27] text-[#C5C8D4] border border-white/[0.08]",
        destructive:
          "bg-[#D9362B] text-white shadow-sm",
        outline:
          "text-white border border-white/[0.15] bg-[#10121A]",
        skyCash:
          "bg-[#00FF66]/15 text-[#00FF66] border border-[#00FF66]/30",
        gsm:
          "bg-[#151722]/90 text-white border border-white/[0.1]",
        exclusive:
          "bg-amber-400/15 text-amber-300 border border-amber-400/30",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };

