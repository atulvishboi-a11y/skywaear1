import React from "react";
import { cn } from "@/lib/utils";

interface MarqueeProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  reverse?: boolean;
  pauseOnHover?: boolean;
  children?: React.ReactNode;
  repeat?: number;
  speedSec?: number;
}

export function Marquee({
  className,
  reverse = false,
  pauseOnHover = true,
  children,
  repeat = 4,
  speedSec = 30,
  ...props
}: MarqueeProps) {
  return (
    <div
      {...props}
      className={cn(
        "group flex overflow-hidden overflow-x-clip max-w-full w-full p-2 select-none [--gap:2rem] [gap:var(--gap)]",
        className
      )}
    >
      {Array.from({ length: repeat }).map((_, i) => (
        <div
          key={i}
          className={cn("flex shrink-0 justify-around [gap:var(--gap)]", {
            "animate-marquee flex-row": !reverse,
            "animate-marquee-reverse flex-row": reverse,
            "group-hover:[animation-play-state:paused]": pauseOnHover,
          })}
          style={{ animationDuration: `${speedSec}s` }}
        >
          {children}
        </div>
      ))}
    </div>
  );
}

