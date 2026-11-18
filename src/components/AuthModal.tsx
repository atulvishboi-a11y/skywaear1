"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  Mail,
  Phone,
  ShieldCheck,
  X,
  Lock,
  Eye,
  EyeOff,
} from "lucide-react";
import { api } from "@/lib/client";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSignedIn: () => void;
  initialMode?: "login" | "signup";
}

type AuthMode = "login" | "signup";
type AuthMethod = "phone" | "email";
type AuthStep = "input" | "otp";

const OTP_LENGTH = 4;
const EMPTY_OTP: string[] = ["", "", "", ""];
const MOBILE_PATTERN = /^[6-9]\d{9}$/;
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[a-zA-Z]{2,}$/;

const MODE_TABS: { value: AuthMode; label: string }[] = [
  { value: "login", label: "Sign In" },
  { value: "signup", label: "Create Account" },
];

const baseField =
  "h-11 w-full min-w-0 rounded-none border border-[#282C34] bg-[#16181D] px-3.5 font-mono text-xs text-[#F5F5F7] placeholder-[#8E929B]/60 focus:outline-none focus:border-[#00FF66]";

export default function AuthModal({
  isOpen,
  onClose,
  onSignedIn,
  initialMode = "login",
}: AuthModalProps) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [loginMethod, setLoginMethod] = useState<"password" | "otp">("password");
  const [method, setMethod] = useState<AuthMethod>("phone");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [step, setStep] = useState<AuthStep>("input");
  const [otp, setOtp] = useState<string[]>(EMPTY_OTP);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  const reset = useCallback(() => {
    setMode(initialMode);
    setLoginMethod("password");
    setMethod("phone");
    setName("");
    setPhone("");
    setEmail("");
    setPassword("");
    setShowPassword(false);
    setStep("input");
    setOtp(EMPTY_OTP);
    setError(null);
    setIsPending(false);
  }, [initialMode]);

  const close = useCallback(() => {
    if (isPending) return;
    reset();
    onClose();
  }, [isPending, onClose, reset]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, close]);

  useEffect(() => {
    if (step === "otp") otpRefs.current[0]?.focus();
  }, [step]);

  const enteredOtp = otp.join("");
  const target = method === "phone" ? `+91 ${phone}` : email.trim();
  const identifier = method === "phone" ? phone : email.trim().toLowerCase();
  const fieldTone = (invalid: boolean) => (invalid ? "border-rose-500" : "border-[#282C34] focus:border-[#00FF66]");

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setError(null);
  };

  const switchMethod = (next: AuthMethod) => {
    setMethod(next);
    setError(null);
  };

  const updateOtp = (index: number, raw: string) => {
    const pasted = raw.replace(/\D/g, "").slice(0, OTP_LENGTH - index);
    setOtp((prev) => {
      const next = [...prev];
      if (!pasted) {
        next[index] = "";
        return next;
      }
      pasted.split("").forEach((digit, offset) => {
        next[index + offset] = digit;
      });
      return next;
    });
    if (pasted) otpRefs.current[Math.min(index + pasted.length, OTP_LENGTH - 1)]?.focus();
  };

  const onOtpKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace" && !otp[index] && index > 0) {
      event.preventDefault();
      otpRefs.current[index - 1]?.focus();
    }
    if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      otpRefs.current[index - 1]?.focus();
    }
    if (event.key === "ArrowRight" && index < OTP_LENGTH - 1) {
      event.preventDefault();
      otpRefs.current[index + 1]?.focus();
    }
  };

  const goToOtpStep = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (mode === "signup" && name.trim().length < 2) {
      setError("Enter your full name so your wallet has an owner.");
      return;
    }
    if (method === "phone" && !MOBILE_PATTERN.test(phone)) {
      setError("Enter a valid 10-digit Indian mobile number.");
      return;
    }
    if (method === "email" && !EMAIL_PATTERN.test(email.trim())) {
      setError("Enter a valid email address.");
      return;
    }

    setIsPending(true);
    try {
      await api.sendOtp(identifier, mode === "signup" ? "signup" : "reset");
      setOtp(EMPTY_OTP);
      setStep("otp");
    } catch (err: any) {
      setError(err?.message || "Failed to dispatch verification code. Please try again.");
    } finally {
      setIsPending(false);
    }
  };

  const handlePasswordSignIn = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (method === "phone" && !MOBILE_PATTERN.test(phone)) {
      setError("Enter a valid 10-digit Indian mobile number.");
      return;
    }
    if (method === "email" && !EMAIL_PATTERN.test(email.trim())) {
      setError("Enter a valid email address.");
      return;
    }
    if (!password) {
      setError("Please enter your account password.");
      return;
    }

    setIsPending(true);
    try {
      await api.signIn(identifier, undefined, undefined, password);
      reset();
      onSignedIn();
      onClose();
    } catch (requestError: any) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Sign in failed. Please check credentials or use SMS OTP."
      );
    } finally {
      setIsPending(false);
    }
  };

  const verifyOtp = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (enteredOtp.length !== OTP_LENGTH) {
      setError(`Enter the complete ${OTP_LENGTH}-digit code.`);
      return;
    }

    setIsPending(true);
    try {
      if (mode === "signup" && password) {
        await api.auth.signUp({
          name: name.trim(),
          phone: method === "phone" ? phone : "",
          email: method === "email" ? email.trim() : undefined,
          password,
          otp: enteredOtp,
        });
      } else {
        // Strictly verifies the real OTP code sent to WhatsApp / SMS
        await api.signIn(identifier, mode === "signup" ? name.trim() : undefined, enteredOtp);
      }
      reset();
      onSignedIn();
      onClose();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Sign in failed. Please retry."
      );
    } finally {
      setIsPending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="zenin-fade fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm font-mono sm:items-center sm:p-6"
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
        className="zenin-sheet relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-none border border-[#282C34] bg-[#0B0C10] text-[#F5F5F7] shadow-2xl sm:max-w-md"
      >
        <header className="flex items-start justify-between gap-3 border-b border-[#282C34] bg-[#16181D] p-4 sm:p-5">
          <div className="min-w-0">
            <h2
              id="auth-modal-title"
              className="truncate text-base font-bold uppercase tracking-wider text-[#F5F5F7]"
            >
              {step === "otp" ? "Verify Code" : mode === "login" ? "Sign In" : "Create Account"}
            </h2>
            <p className="mt-0.5 truncate font-mono text-xs text-[#8E929B]">
              {step === "otp"
                ? `Code issued for ${target}`
                : "Coins wallet, cashback and order history unlock here."}
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            disabled={isPending}
            aria-label="Close sign in"
            className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-none text-[#8E929B] transition-colors hover:bg-[#282C34] hover:text-[#F5F5F7] disabled:opacity-40"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {step === "input" && (
          <div className="grid grid-cols-2 border-b border-[#282C34] bg-[#0B0C10] text-[11px] font-bold uppercase tracking-wider">
            {MODE_TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => switchMode(tab.value)}
                aria-pressed={mode === tab.value}
                className={`min-h-11 border-b-2 transition-colors rounded-none ${
                  mode === tab.value
                    ? "border-[#00FF66] text-[#00FF66] bg-[#16181D]"
                    : "border-transparent text-[#8E929B] hover:text-[#F5F5F7] hover:bg-[#16181D]/40"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 sm:p-5 bg-[#0B0C10]">
          {step === "input" ? (
            <form
              noValidate
              onSubmit={mode === "login" && loginMethod === "password" ? handlePasswordSignIn : goToOtpStep}
              className="space-y-4"
            >
              {/* Sign In sub-tabs: Password vs WhatsApp OTP */}
              {mode === "login" && (
                <div className="flex gap-1 rounded-none border border-[#282C34] bg-[#16181D] p-1">
                  <button
                    type="button"
                    onClick={() => {
                      setLoginMethod("password");
                      setError(null);
                    }}
                    className={`flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-none text-[11px] font-bold uppercase tracking-wider transition-colors ${
                      loginMethod === "password"
                        ? "bg-[#00FF66] text-[#0B0C10]"
                        : "text-[#8E929B] hover:text-[#F5F5F7]"
                    }`}
                  >
                    <Lock className="h-3.5 w-3.5" />
                    <span>Password</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLoginMethod("otp");
                      setError(null);
                    }}
                    className={`flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-none text-[11px] font-bold uppercase tracking-wider transition-colors ${
                      loginMethod === "otp"
                        ? "bg-[#00FF66] text-[#0B0C10]"
                        : "text-[#8E929B] hover:text-[#F5F5F7]"
                    }`}
                  >
                    <Phone className="h-3.5 w-3.5" />
                    <span>SMS OTP</span>
                  </button>
                </div>
              )}

              <div className="flex gap-1 rounded-none border border-[#282C34] bg-[#16181D] p-1">
                <button
                  type="button"
                  onClick={() => switchMethod("phone")}
                  aria-pressed={method === "phone"}
                  className={`flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-none text-[11px] font-bold uppercase tracking-wider transition-colors ${
                    method === "phone"
                      ? "bg-[#282C34] text-white"
                      : "text-[#8E929B] hover:text-[#F5F5F7]"
                  }`}
                >
                  <Phone className="h-3.5 w-3.5" />
                  <span>Mobile</span>
                </button>
                <button
                  type="button"
                  onClick={() => switchMethod("email")}
                  aria-pressed={method === "email"}
                  className={`flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-none text-[11px] font-bold uppercase tracking-wider transition-colors ${
                    method === "email"
                      ? "bg-[#282C34] text-white"
                      : "text-[#8E929B] hover:text-[#F5F5F7]"
                  }`}
                >
                  <Mail className="h-3.5 w-3.5" />
                  <span>Email</span>
                </button>
              </div>

              {mode === "signup" && (
                <div>
                  <label
                    htmlFor="auth-name"
                    className="mb-1 block font-mono text-[11px] font-bold uppercase text-[#8E929B]"
                  >
                    Full name
                  </label>
                  <input
                    id="auth-name"
                    name="name"
                    type="text"
                    autoComplete="name"
                    placeholder="Aman Sharma"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className={baseField}
                  />
                </div>
              )}

              {method === "phone" ? (
                <div>
                  <label
                    htmlFor="auth-phone"
                    className="mb-1 block font-mono text-[11px] font-bold uppercase text-[#8E929B]"
                  >
                    Mobile number
                  </label>
                  <div className="flex gap-2">
                    <span className="flex h-11 shrink-0 items-center rounded-none border border-[#282C34] bg-[#16181D] px-3 font-mono text-xs font-bold text-[#00FF66]">
                      +91
                    </span>
                    <input
                      id="auth-phone"
                      name="phone"
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel-national"
                      maxLength={10}
                      placeholder="9876543210"
                      value={phone}
                      onChange={(event) => setPhone(event.target.value.replace(/\D/g, ""))}
                      className={baseField}
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label
                    htmlFor="auth-email"
                    className="mb-1 block font-mono text-[11px] font-bold uppercase text-[#8E929B]"
                  >
                    Email address
                  </label>
                  <input
                    id="auth-email"
                    name="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className={baseField}
                  />
                </div>
              )}

              {(mode === "signup" || (mode === "login" && loginMethod === "password")) && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label
                      htmlFor="auth-password"
                      className="font-mono text-[11px] font-bold uppercase text-[#8E929B]"
                    >
                      {mode === "signup" ? "Create Password" : "Password"}
                    </label>
                    {mode === "login" && (
                      <a
                        href="/forgot-password"
                        className="font-mono text-[10px] text-[#00FF66] hover:underline"
                      >
                        Forgot Password?
                      </a>
                    )}
                  </div>
                  <div className="relative flex items-center">
                    <input
                      id="auth-password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete={mode === "signup" ? "new-password" : "current-password"}
                      placeholder="Enter account password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className={`${baseField} pr-10`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 text-[#8E929B] hover:text-[#F5F5F7]"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              )}

              {error && (
                <p
                  role="alert"
                  className="rounded-none border border-rose-500/40 bg-rose-500/10 px-3 py-2 font-mono text-[11px] font-bold text-rose-400"
                >
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={isPending}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-none bg-[#00FF66] text-xs font-black uppercase tracking-[1px] text-[#0B0C10] shadow-none transition-all hover:bg-[#00FF66]/90 cursor-pointer disabled:opacity-50"
              >
                {isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Authenticating…</span>
                  </>
                ) : mode === "login" && loginMethod === "password" ? (
                  <>
                    <Lock className="h-4 w-4" />
                    <span>Sign In with Password</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                ) : (
                  <>
                    <span>Send Verification Code</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>

              <p className="font-mono text-[10px] text-[#8E929B]">
                {mode === "login"
                  ? "Sign in with your password or SMS verification code."
                  : "First sign-in creates your account automatically."}
              </p>
            </form>
          ) : (
            <form noValidate onSubmit={(event) => void verifyOtp(event)} className="space-y-4">
              <div className="flex items-center justify-between gap-2 rounded-none border border-[#282C34] bg-[#16181D] px-3 py-2">
                <span className="min-w-0 truncate font-mono text-[11px] text-[#00FF66]">{target}</span>
                <button
                  type="button"
                  onClick={() => {
                    setStep("input");
                    setError(null);
                  }}
                  disabled={isPending}
                  className="flex shrink-0 items-center gap-1 font-mono text-[11px] font-bold uppercase text-[#8E929B] transition-colors hover:text-[#F5F5F7] disabled:opacity-40"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Change</span>
                </button>
              </div>

              <fieldset>
                <legend className="mb-2 font-mono text-[11px] font-bold uppercase tracking-wider text-[#8E929B]">
                  4-digit verification code
                </legend>
                <div className="flex justify-center gap-1.5 sm:gap-2">
                  {otp.map((digit, index) => (
                    <input
                      key={index}
                      ref={(element) => {
                        otpRefs.current[index] = element;
                      }}
                      type="text"
                      inputMode="numeric"
                      autoComplete={index === 0 ? "one-time-code" : "off"}
                      maxLength={1}
                      value={digit}
                      disabled={isPending}
                      aria-label={`Digit ${index + 1}`}
                      aria-invalid={error ? true : undefined}
                      onChange={(event) => updateOtp(index, event.target.value)}
                      onPaste={(event) => {
                        const clipboard = event.clipboardData.getData("text").replace(/\D/g, "");
                        if (!clipboard) return;
                        event.preventDefault();
                        updateOtp(index, clipboard);
                      }}
                      onKeyDown={(event) => onOtpKeyDown(index, event)}
                      className={`h-12 w-10 rounded-none border bg-[#16181D] text-center font-mono text-lg font-bold text-[#F5F5F7] focus:outline-none focus:border-[#00FF66] disabled:opacity-60 sm:h-14 sm:w-11 ${fieldTone(
                        Boolean(error) && !digit
                      )}`}
                    />
                  ))}
                </div>
              </fieldset>

              {enteredOtp.length === OTP_LENGTH && (
                <p className="flex items-center justify-center gap-1.5 font-mono text-[11px] font-bold uppercase text-[#00FF66]">
                  <Check className="h-3.5 w-3.5" />
                  <span>Code complete</span>
                </p>
              )}

              <p className="rounded-none border border-amber-400/40 bg-amber-400/10 p-3 font-mono text-[11px] text-amber-300">
                Demo OTP step — no SMS or email is sent in this sandbox, so any 6 digits work. The
                real session is created server-side when you verify.
              </p>

              {error && (
                <p
                  role="alert"
                  className="rounded-none border border-rose-500/40 bg-rose-500/10 px-3 py-2 font-mono text-[11px] font-bold text-rose-400"
                >
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={isPending}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-none bg-[#00FF66] text-xs font-black uppercase tracking-[1px] text-[#0B0C10] shadow-none transition-all hover:bg-[#00FF66]/90 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
              >
                {isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Signing in…</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-4 w-4 text-[#0B0C10]" />
                    <span>Verify &amp; Sign In</span>
                  </>
                )}
              </button>

              <p className="font-mono text-[10px] text-[#8E929B]">
                We never ask for passwords, card details or UPI PINs by OTP.
              </p>
            </form>
          )}
        </div>

        <p className="border-t border-[#282C34] bg-[#16181D] px-4 py-3 text-center font-mono text-[10px] text-[#8E929B]">
          By continuing you agree to Skywear&apos;s Terms of Service and Privacy Policy.
        </p>
      </section>
    </div>
  );
}
