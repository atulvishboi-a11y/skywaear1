"use client";

import React, { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { AuthUI } from "@/components/ui/auth-ui";
import { api } from "@/lib/client";
import SkywearLogo from "@/components/SkywearLogo";
import { getStoredReferral, saveReferral, clearReferral } from "@/lib/referral-tracker";

function disarmBeforeUnload() {
  if (typeof window === "undefined") return;
  try {
    window.onbeforeunload = null;
  } catch {}
  const silence = (e: BeforeUnloadEvent) => {
    e.stopImmediatePropagation();
    delete (e as any).returnValue;
  };
  window.addEventListener("beforeunload", silence, { capture: true });
}

function RegisterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirect") || "/app/account";

  const urlRef = searchParams.get("ref");
  if (urlRef?.trim()) {
    saveReferral(urlRef.trim().toUpperCase());
  }
  const initialRef = urlRef?.trim() || getStoredReferral().code || "";

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ensure no unwanted beforeunload prompt occurs on the auth page
  useEffect(() => {
    disarmBeforeUnload();
  }, []);

  const handleSignIn = async (data: { identifier: string; password?: string; otp?: string }) => {
    setError(null);
    if (!data.identifier.trim()) {
      setError("Please enter your email or mobile number.");
      return;
    }
    if (!data.password && !data.otp) {
      setError("Please enter your password or SMS verification code.");
      return;
    }

    setIsLoading(true);
    try {
      await api.auth.login({
        identifier: data.identifier.trim(),
        password: data.password,
        otp: data.otp,
      });

      // Disarm beforeunload immediately prior to navigation
      disarmBeforeUnload();
      clearReferral();

      toast.success("Welcome back!", {
        description: "Successfully signed in to your Skywear account.",
      });

      window.location.href = redirectUrl;
    } catch (err: any) {
      setError(err?.message || "Sign in failed. Please verify your credentials.");
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (data: { name: string; email?: string; phone: string; password?: string; otp: string; referralCode?: string }) => {
    setError(null);
    if (!data.name.trim()) {
      setError("Please enter your full name.");
      return;
    }
    const cleanPhone = data.phone.replace(/\D/g, "");
    if (!cleanPhone || cleanPhone.length < 10) {
      setError("Please enter a valid 10-digit Indian mobile number.");
      return;
    }
    if (!data.otp?.trim()) {
      setError("Please enter the 4-digit verification code sent via SMS to your mobile number.");
      return;
    }

    setIsLoading(true);
    try {
      await api.auth.signUp({
        name: data.name.trim(),
        phone: cleanPhone,
        email: data.email?.trim() || undefined,
        password: data.password || ("Skywear@" + cleanPhone.slice(-4)),
        otp: data.otp.trim(),
        referralCode: data.referralCode || initialRef || undefined,
      });

      // Disarm beforeunload immediately prior to navigation
      disarmBeforeUnload();
      clearReferral();

      toast.success("Account created!", {
        description: `Welcome to Skywear, ${data.name.trim()}!`,
      });

      window.location.href = redirectUrl;
    } catch (err: any) {
      setError(err?.message || "Failed to create account. Please check the code and try again.");
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-background">
      {/* Top Navigation Bar with Back to Shop and Logo */}
      <div className="absolute top-4 left-4 right-4 sm:top-6 sm:left-6 sm:right-6 z-30 flex items-center justify-between pointer-events-none">
        <Link
          href="/"
          className="pointer-events-auto flex items-center gap-2 px-3 py-1.5 rounded-none border border-border bg-background/80 backdrop-blur-md text-xs font-mono text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Store</span>
        </Link>
        <Link href="/" className="pointer-events-auto sm:hidden">
          <SkywearLogo size="sm" variant="icon" />
        </Link>
      </div>

      <AuthUI
        initialIsSignIn={false}
        initialReferralCode={initialRef}
        onSignInSubmit={handleSignIn}
        onSignUpSubmit={handleSignUp}
        isLoading={isLoading}
        error={error}
      />
    </div>
  );
}

export default function RegisterClient() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-background text-foreground text-xs font-mono">Loading authentication...</div>}>
      <RegisterContent />
    </Suspense>
  );
}
