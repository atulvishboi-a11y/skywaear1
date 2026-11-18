"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useEffect, useLayoutEffect } from "react";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

// Use useIsomorphicLayoutEffect for SSR safety
export const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * Returns true if the user's OS / browser settings request reduced motion.
 */
export function isReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Clean React hook for managing GSAP animations with automatic lifecycle cleanup.
 */
export function useGsapContext(
  scopeRef: React.RefObject<HTMLElement | null>,
  animationFn: (context: gsap.Context) => void,
  deps: React.DependencyList = []
) {
  useIsomorphicLayoutEffect(() => {
    if (!scopeRef.current) return;

    const ctx = gsap.context(() => {
      if (!isReducedMotion()) {
        animationFn(ctx);
      }
    }, scopeRef);

    return () => {
      ctx.revert();
    };
  }, deps);
}

/**
 * 3. Smooth Fade-and-Scale Animation for Notifications, Popups, and Overlays.
 * Scale: 0.95 -> 1.0 with subtle back spring finish (220ms).
 */
export function animatePopupScale(
  element: HTMLElement | null,
  onComplete?: () => void
): gsap.core.Tween | null {
  if (!element) {
    onComplete?.();
    return null;
  }

  if (isReducedMotion()) {
    gsap.set(element, { opacity: 1, scale: 1, clearProps: "transform,opacity" });
    onComplete?.();
    return null;
  }

  return gsap.fromTo(
    element,
    {
      opacity: 0,
      scale: 0.95,
      force3D: true,
    },
    {
      opacity: 1,
      scale: 1,
      duration: 0.22,
      ease: "back.out(1.3)",
      clearProps: "transform,opacity",
      onComplete,
    }
  );
}

/**
 * Smooth GSAP tally / counter animation for numbers & metrics.
 */
export function animateCountUp(
  element: HTMLElement | null,
  targetValue: number,
  prefix = "",
  suffix = "",
  duration = 0.8
) {
  if (!element) return;
  if (isReducedMotion()) {
    element.textContent = `${prefix}${targetValue.toLocaleString("en-IN")}${suffix}`;
    return;
  }

  const obj = { val: 0 };
  gsap.to(obj, {
    val: targetValue,
    duration,
    ease: "power2.out",
    onUpdate: () => {
      element.textContent = `${prefix}${Math.round(obj.val).toLocaleString("en-IN")}${suffix}`;
    },
  });
}

/**
 * Hero Section Animated Entrance.
 */
export function animateHeroEntrance(
  container: HTMLElement | null
): gsap.core.Timeline | null {
  if (!container || isReducedMotion()) return null;

  const title = container.querySelector("h1");
  const buttons = container.querySelectorAll("a, button");

  const tl = gsap.timeline({ defaults: { ease: "power2.out" } });

  if (title) {
    tl.fromTo(
      title,
      { opacity: 0, scale: 0.99 },
      { opacity: 1, scale: 1, duration: 0.5, clearProps: "transform,opacity" }
    );
  }

  if (buttons.length > 0) {
    tl.fromTo(
      buttons,
      { opacity: 0 },
      { opacity: 1, duration: 0.35, stagger: 0.06, clearProps: "opacity" },
      "-=0.25"
    );
  }

  return tl;
}

/**
 * Staggered Entrance for cards, list items, or grids.
 */
export function staggerEntrance(
  selectorOrElements: string | Element[] | NodeListOf<Element>,
  parentScope?: HTMLElement | null,
  staggerMs = 0.03
): gsap.core.Tween | null {
  if (isReducedMotion()) return null;

  const targets =
    typeof selectorOrElements === "string" && parentScope
      ? parentScope.querySelectorAll(selectorOrElements)
      : selectorOrElements;

  if (!targets || (Array.isArray(targets) && targets.length === 0)) return null;

  return gsap.fromTo(
    targets,
    {
      opacity: 0,
      scale: 0.99,
      force3D: true,
    },
    {
      opacity: 1,
      scale: 1,
      duration: 0.28,
      stagger: staggerMs,
      ease: "power2.out",
      clearProps: "transform,opacity",
    }
  );
}

/**
 * Scroll-triggered Section Reveal.
 */
export function animateOnScroll(
  section: HTMLElement | null,
  options?: { duration?: number }
) {
  if (!section || isReducedMotion()) return null;

  return gsap.fromTo(
    section,
    {
      opacity: 0,
      force3D: true,
    },
    {
      opacity: 1,
      duration: options?.duration ?? 0.35,
      ease: "power2.out",
      clearProps: "opacity",
      scrollTrigger: {
        trigger: section,
        start: "top 90%",
        once: true,
      },
    }
  );
}

/**
 * Modal dialog pop entrance with spring finish (alias to animatePopupScale).
 */
export function animateModalEnter(
  element: HTMLElement | null,
  onComplete?: () => void
): gsap.core.Tween | null {
  return animatePopupScale(element, onComplete);
}

export { gsap, ScrollTrigger };
export default gsap;
