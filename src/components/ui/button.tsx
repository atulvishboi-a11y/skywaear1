import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] select-none cursor-pointer [touch-action:manipulation] [-webkit-tap-highlight-color:transparent]",
  {
    variants: {
      variant: {
        default:
          "bg-white text-black hover:bg-neutral-200 shadow-md",
        destructive:
          "bg-[#D9362B] text-white hover:bg-[#B82B22] shadow-md",
        outline:
          "border border-white/[0.15] bg-[#12141C] text-white hover:bg-white hover:text-black hover:border-white",
        secondary:
          "bg-[#1A1D27] text-white hover:bg-[#232734] border border-white/[0.08]",
        ghost:
          "text-[#8E929B] hover:text-white hover:bg-white/[0.06]",
        link:
          "text-[#00FF66] underline-offset-4 hover:underline p-0 h-auto",
        skyCash:
          "bg-[#00FF66] text-black font-black hover:bg-[#00E65C] shadow-lg",
        brandRed:
          "bg-[#D9362B] text-white font-black hover:bg-[#B82B22] shadow-lg",
      },
      size: {
        default: "h-11 px-5 py-2.5",
        sm: "h-9 rounded-lg px-3.5 text-[11px]",
        lg: "h-13 rounded-2xl px-7 text-sm font-black",
        icon: "h-10 w-10 p-0 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };

