"use client";

import React, { useState, useRef, useEffect, Suspense } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Phone, Mail, CheckCircle2, ArrowRight, ShieldCheck, Loader2, Lock, Eye, EyeOff } from "lucide-react";
import { api } from "@/lib/client";

function ForgotPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillIdentifier = searchParams.get("identifier") || "";

  const [step, setStep] = useState<"request" | "reset" | "success">("request");
  const [identifier, setIdentifier] = useState(prefillIdentifier);
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [simulatedCode, setSimulatedCode] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Disarm any unwanted beforeunload prompt on reset password flow
  useEffect(() => {
    const disarm = (e: BeforeUnloadEvent) => {
      e.stopImmediatePropagation();
      delete (e as any).returnValue;
    };
    window.addEventListener("beforeunload", disarm, { capture: true });
    try {
      window.onbeforeunload = null;
    } catch {}
    return () => {
      window.removeEventListener("beforeunload", disarm, { capture: true });
    };
  }, []);

  useEffect(() => {
    if (prefillIdentifier) {
      setIdentifier(prefillIdentifier);
    }
  }, [prefillIdentifier]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);

    const clean = identifier.trim();
    if (!clean) {
      setError("Please enter your registered mobile number or email.");
      return;
    }

    setLoading(true);
    try {
      const res = await api.auth.sendOtp({
        target: clean,
        type: "reset",
      });

      setInfoMessage(res.message || "Reset verification code dispatched.");
      setResendCooldown(30);
      setStep("reset");
    } catch (err: any) {
      setError(err?.message || "Failed to dispatch reset code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!otp.trim()) {
      setError("Please enter the verification code.");
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      setError("New password must be at least 6 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match. Please re-enter.");
      return;
    }

    setLoading(true);
    try {
      await api.auth.resetPassword({
        identifier: identifier.trim(),
        otp: otp.trim(),
        newPassword,
      });

      setStep("success");
    } catch (err: any) {
      setError(err?.message || "Password reset failed. Please check your verification code.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto bg-[#11131A] border border-white/[0.08] p-6 sm:p-8 space-y-6">
      <div className="text-center space-y-1">
        <span className="text-[10px] text-[#D9362B] font-bold uppercase tracking-widest font-mono">
          SECURITY &amp; ACCESS RESTORATION
        </span>
        <h1
          className="text-2xl font-bold uppercase text-white"
          style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}
        >
          Reset Credentials
        </h1>
        <p className="text-xs text-[#8E929B] font-mono">
          Dispatch a security code to your registered mobile (via APITxT) or Gmail (via SMTP).
        </p>
      </div>

      {error && (
        <div className="p-3 border border-rose-500/40 bg-rose-500/10 text-rose-400 text-xs font-mono">
          {error}
        </div>
      )}

      {infoMessage && step === "reset" && (
        <div className="p-3 border border-[#00FF66]/30 bg-[#00FF66]/10 text-[#00FF66] text-xs font-mono">
          {infoMessage}
        </div>
      )}

      {step === "success" ? (
        <div className="p-6 border border-[#00FF66]/40 bg-[#00FF66]/10 text-center space-y-3 font-mono">
          <CheckCircle2 className="w-10 h-10 text-[#00FF66] mx-auto" />
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Password Reset Completed</h3>
          <p className="text-xs text-[#C8C5BC] font-sans">
            Your new account password has been saved securely. You can now log into your account using your updated credentials.
          </p>
          <div className="pt-3">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#00FF66] hover:bg-[#00FF66]/90 text-[#0B0C10] font-bold text-xs uppercase tracking-wider transition-colors"
            >
              Sign In to Your Account <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      ) : step === "request" ? (
        <form onSubmit={handleSendCode} className="space-y-4 font-mono text-xs">
          <div>
            <label className="block text-[10px] uppercase text-[#8E929B] font-bold mb-1">
              Registered Mobile (+91) or Gmail / Email
            </label>
            <input
              type="text"
              required
              placeholder="e.g. 9876543210 or aman@example.com"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="w-full bg-[#0A0B0E] border border-white/[0.08] p-2.5 text-white focus:outline-none focus:border-[#D9362B]"
            />
            <span className="text-[10px] text-[#8E929B] mt-1 block">
              SMS OTP is sent to mobile numbers. Reset link and security code are dispatched to Gmail.
            </span>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-[#D9362B] hover:bg-[#F27A6F] text-white font-bold uppercase tracking-wider text-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Dispatching Code...
              </>
            ) : (
              <>
                Send Verification Code <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </form>
      ) : (
        <form onSubmit={handleResetPassword} className="space-y-4 font-mono text-xs">
          <div>
            <label className="block text-[10px] uppercase text-[#8E929B] font-bold mb-1">
              Verification Code (OTP)
            </label>
            <input
              type="text"
              required
              placeholder="Enter 4-digit code"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              className="w-full bg-[#0A0B0E] border border-white/[0.08] p-2.5 text-white tracking-widest text-center text-lg font-bold focus:outline-none focus:border-[#00FF66]"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase text-[#8E929B] font-bold mb-1">
              New Password (Min 6 Characters)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-3 text-[#8E929B]">
                <Lock className="w-3.5 h-3.5" />
              </span>
              <input
                type={showPassword ? "text" : "password"}
                required
                minLength={6}
                placeholder="Enter new password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-[#0A0B0E] border border-white/[0.08] pl-9 pr-10 p-2.5 text-white focus:outline-none focus:border-[#D9362B]"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-[#8E929B] hover:text-white"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[10px] uppercase text-[#8E929B] font-bold mb-1">
              Confirm New Password
            </label>
            <div className="relative">
              <span className="absolute left-3 top-3 text-[#8E929B]">
                <Lock className="w-3.5 h-3.5" />
              </span>
              <input
                type={showPassword ? "text" : "password"}
                required
                minLength={6}
                placeholder="Re-enter new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-[#0A0B0E] border border-white/[0.08] pl-9 pr-10 p-2.5 text-white focus:outline-none focus:border-[#D9362B]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-[#00FF66] hover:bg-[#00FF66]/90 text-[#0B0C10] font-bold uppercase tracking-wider text-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Updating Password...
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" /> Update Password &amp; Save
              </>
            )}
          </button>

          <div className="flex items-center justify-between text-[11px] pt-1">
            <button
              type="button"
              onClick={() => setStep("request")}
              className="text-[#8E929B] hover:text-white transition-colors"
            >
              ← Change mobile/email
            </button>
            <button
              type="button"
              disabled={resendCooldown > 0 || loading}
              onClick={handleSendCode}
              className={`font-bold transition-colors ${
                resendCooldown > 0 ? "text-[#555] cursor-not-allowed" : "text-[#00FF66] hover:underline"
              }`}
            >
              {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend Code"}
            </button>
          </div>
        </form>
      )}

      <div className="pt-4 border-t border-white/[0.08] text-center text-xs font-mono">
        <Link href="/login" className="text-[#8E929B] hover:text-white inline-flex items-center gap-1.5">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Sign In
        </Link>
      </div>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen bg-[#0A0B0E] text-[#F5F5F7] font-mono flex flex-col selection:bg-[#D9362B] selection:text-white">
      <Header />
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-16">
        <Suspense fallback={<div className="text-xs text-[#8E929B]">Loading recovery...</div>}>
          <ForgotPasswordContent />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}
