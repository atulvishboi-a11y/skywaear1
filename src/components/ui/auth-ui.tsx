"use client";

import * as React from "react";
import { useState, useId, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Slot } from "@radix-ui/react-slot";
import * as LabelPrimitive from "@radix-ui/react-label";
import { cva, type VariantProps } from "class-variance-authority";
import {
  Eye,
  EyeOff,
  Phone,
  Lock,
  Loader2,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Gift,
  AlertCircle,
  User,
  ShieldCheck,
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import SkywearLogo from "@/components/SkywearLogo";
import { getStoredReferral, recoverReferralFromServer } from "@/lib/referral-tracker";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const labelVariants = cva(
  "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
);

const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> &
    VariantProps<typeof labelVariants>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(labelVariants(), className)}
    {...props}
  />
));
Label.displayName = LabelPrimitive.Root.displayName;

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 cursor-pointer active:scale-[0.98]",
  {
    variants: {
      variant: {
        default: "bg-[#00FF66] text-black font-bold hover:bg-[#00E65C]",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input dark:border-input/50 bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary-foreground/60 underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-4 py-2",
        sm: "h-9 rounded-md px-3 text-xs",
        lg: "h-12 rounded-md px-6 text-base",
        icon: "h-8 w-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);
Button.displayName = "Button";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-11 w-full rounded-lg border border-input dark:border-input/50 bg-background px-3.5 py-3 text-sm text-foreground shadow-sm shadow-black/5 transition-shadow placeholder:text-muted-foreground/60 focus-visible:bg-accent focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export interface PasswordInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}
const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, label, ...props }, ref) => {
    const id = useId();
    const [showPassword, setShowPassword] = useState(false);
    const togglePasswordVisibility = () => setShowPassword((prev) => !prev);
    return (
      <div className="grid w-full items-center gap-2">
        {label && <Label htmlFor={id}>{label}</Label>}
        <div className="relative">
          <Input id={id} type={showPassword ? "text" : "password"} className={cn("pe-10", className)} ref={ref} {...props} />
          <button type="button" onClick={togglePasswordVisibility} className="absolute inset-y-0 end-0 flex h-full w-10 items-center justify-center text-muted-foreground/80 transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 cursor-pointer" aria-label={showPassword ? "Hide password" : "Show password"}>
            {showPassword ? (<EyeOff className="size-4" aria-hidden="true" />) : (<Eye className="size-4" aria-hidden="true" />)}
          </button>
        </div>
      </div>
    );
  }
);
PasswordInput.displayName = "PasswordInput";

export { Button, Input, Label, PasswordInput };

/* -------------------------------------------------------------------------- */
/*                     UNIFIED SLIDER AUTHENTICATION                          */
/* -------------------------------------------------------------------------- */

export interface AuthUIProps {
  initialIsSignIn?: boolean;
  signInContent?: any;
  signUpContent?: any;
  onSignInSubmit?: (data: { identifier: string; password?: string; otp?: string; email?: string }) => Promise<void> | void;
  onSignUpSubmit?: (data: { name: string; email?: string; phone: string; password?: string; otp: string; referralCode?: string }) => Promise<void> | void;
  isLoading?: boolean;
  error?: string | null;
  initialReferralCode?: string;
}

export function AuthUI({
  onSignInSubmit,
  onSignUpSubmit,
  isLoading = false,
  error,
  initialReferralCode,
}: AuthUIProps) {
  // Slider step: "phone" (screen 1) | "details" (screen 2)
  const [step, setStep] = useState<"phone" | "details">("phone");
  const [userMode, setUserMode] = useState<"login" | "register">("login");
  const [loginMethod, setLoginMethod] = useState<"password" | "otp">("password");
  const [existingUserName, setExistingUserName] = useState<string | null>(null);

  // Form Fields
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [referralCode, setReferralCode] = useState(initialReferralCode || "");
  const [showReferral, setShowReferral] = useState(false);

  // OTP Verification for New Registration
  const [otp, setOtp] = useState<string[]>(["", "", "", ""]);
  const [otpSent, setOtpSent] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // Status & Errors
  const [isCheckingPhone, setIsCheckingPhone] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const submittedRef = useRef(false);

  // Form dirty state tracker
  const isDirty = Boolean(phone || name || password || otp.some(Boolean));

  // Disarm and bypass any browser-native "Leave site? Changes that you made may not be saved." dialog
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Disarm browser confirmation completely if submitted or whenever navigating during auth flow
      e.stopImmediatePropagation();
      delete (e as any).returnValue;
    };

    window.addEventListener("beforeunload", handleBeforeUnload, { capture: true });
    try {
      window.onbeforeunload = null;
    } catch {}

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload, { capture: true });
    };
  }, []);

  // Focus & Caching refs
  const phoneInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // In-memory cache for phone checks to avoid database/server load
  const checkCache = useRef<Map<string, { exists: boolean; name: string | null; email: string | null }>>(new Map());

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((prev) => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // Initial referral code from URL, storage, or emergency server fingerprint
  useEffect(() => {
    if (initialReferralCode?.trim()) {
      setReferralCode(initialReferralCode.toUpperCase());
      setShowReferral(true);
    } else if (typeof window !== "undefined") {
      try {
        const stored = getStoredReferral();
        if (stored.code) {
          setReferralCode(stored.code.toUpperCase());
          setShowReferral(true);
        } else {
          recoverReferralFromServer().then((rec) => {
            if (rec.code) {
              setReferralCode(rec.code.toUpperCase());
              setShowReferral(true);
            }
          }).catch(() => {});
        }
      } catch {}
    }
  }, [initialReferralCode]);

  // Handle Phone Validation and Transition to Slide 2
  const checkAndProceedWithPhone = useCallback(async (targetPhone?: string) => {
    let rawDigits = (targetPhone !== undefined ? targetPhone : phone).replace(/\D/g, "");
    if (rawDigits.startsWith("91") && rawDigits.length > 10) rawDigits = rawDigits.slice(2);
    else if (rawDigits.startsWith("0") && rawDigits.length > 10) rawDigits = rawDigits.slice(1);
    if (rawDigits.length > 10) rawDigits = rawDigits.slice(-10);

    if (rawDigits.length !== 10) {
      setLocalError("Please enter a valid 10-digit mobile number.");
      return;
    }

    setLocalError(null);

    // 1. Check local cache first (0 server load)
    const cached = checkCache.current.get(rawDigits);
    if (cached) {
      setUserMode(cached.exists ? "login" : "register");
      setLoginMethod("password");
      setExistingUserName(cached.name);
      if (cached.email && !email) setEmail(cached.email);
      setStep("details");
      setOtpSent(false);
      setTimeout(() => {
        if (cached.exists) {
          passwordInputRef.current?.focus();
        } else {
          nameInputRef.current?.focus();
        }
      }, 320);
      return;
    }

    // 2. Fetch from lightweight memory check endpoint
    setIsCheckingPhone(true);
    try {
      const res = await fetch("/api/auth/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: rawDigits }),
      });
      const json = await res.json().catch(() => ({}));
      const exists = Boolean(res.ok && (json.exists ?? json.data?.exists ?? false));
      const matchedName = json.name ?? json.data?.name ?? null;
      const matchedEmail = json.email ?? json.data?.email ?? null;

      // Cache result locally
      checkCache.current.set(rawDigits, { exists, name: matchedName, email: matchedEmail });

      setUserMode(exists ? "login" : "register");
      setLoginMethod("password");
      setExistingUserName(matchedName);
      if (matchedEmail && !email) setEmail(matchedEmail);
      setStep("details");
      setOtpSent(false);

      // Slide and focus next input
      setTimeout(() => {
        if (exists) {
          passwordInputRef.current?.focus();
        } else {
          nameInputRef.current?.focus();
        }
      }, 320);
    } catch {
      // Default to login on check error
      setUserMode("login");
      setLoginMethod("password");
      setStep("details");
      setOtpSent(false);
    } finally {
      setIsCheckingPhone(false);
    }
  }, [phone]);

  // Send SMS OTP via APITxT (supports both signup and login flows)
  const handleSendSmsOtp = async (overrideType?: "signup" | "login") => {
    setLocalError(null);
    let cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.startsWith("91") && cleanPhone.length > 10) cleanPhone = cleanPhone.slice(2);
    else if (cleanPhone.startsWith("0") && cleanPhone.length > 10) cleanPhone = cleanPhone.slice(1);
    if (cleanPhone.length > 10) cleanPhone = cleanPhone.slice(-10);

    if (cleanPhone.length !== 10) {
      setLocalError("Please enter a valid 10-digit mobile number.");
      return false;
    }

    const flowType = overrideType || (userMode === "login" ? "login" : "signup");

    setSendingOtp(true);
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: cleanPhone, type: flowType }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.success) {
        const errorMsg =
          typeof data.error === "string"
            ? data.error
            : data.error?.message || data.message || "Failed to dispatch SMS OTP";

        if (res.status === 409) {
          // Account already exists with this phone: switch seamlessly to login
          setUserMode("login");
          setLocalError(errorMsg);
          toast.info("Account Already Exists", {
            description: "Please enter your password or sign in with SMS OTP.",
          });
          setTimeout(() => passwordInputRef.current?.focus(), 250);
          return false;
        }

        throw new Error(errorMsg);
      }

      toast.success("SMS Code Sent", {
        description: data.otp
          ? `Dev code: ${data.otp} (+91 ${cleanPhone})`
          : `4-digit verification code sent to +91 ${cleanPhone}`,
      });
      setOtpSent(true);
      setCooldown(60); // 60s cooldown rate limit
      setOtp(["", "", "", ""]);
      setTimeout(() => otpRefs.current[0]?.focus(), 150);
      return true;
    } catch (err: any) {
      setLocalError(err?.message || "Failed to send SMS code. Please try again.");
      return false;
    } finally {
      setSendingOtp(false);
    }
  };

  // Robust OTP input handlers with paste & backspace navigation
  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 4);
    if (!pasted) return;
    const chars = pasted.split("");
    const next = ["", "", "", ""];
    chars.forEach((c, i) => {
      if (i < 4) next[i] = c;
    });
    setOtp(next);
    otpRefs.current[Math.min(chars.length - 1, 3)]?.focus();
  };

  const handleOtpChange = (e: React.ChangeEvent<HTMLInputElement>, idx: number) => {
    const raw = e.target.value.replace(/\D/g, "");
    if (raw.length > 1) {
      const chars = raw.slice(0, 4).split("");
      const next = [...otp];
      chars.forEach((c, i) => {
        if (i < 4) next[i] = c;
      });
      setOtp(next);
      otpRefs.current[Math.min(chars.length, 3)]?.focus();
      return;
    }
    const val = raw.slice(-1);
    const next = [...otp];
    next[idx] = val;
    setOtp(next);
    if (val && idx < 3) otpRefs.current[idx + 1]?.focus();
  };

  const handleOtpKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, idx: number) => {
    if (e.key === "Backspace" && !otp[idx] && idx > 0) {
      otpRefs.current[idx - 1]?.focus();
    }
  };

  // Submit Sign In (Existing User via Password or OTP)
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    let cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.startsWith("91") && cleanPhone.length > 10) cleanPhone = cleanPhone.slice(2);
    else if (cleanPhone.startsWith("0") && cleanPhone.length > 10) cleanPhone = cleanPhone.slice(1);
    if (cleanPhone.length > 10) cleanPhone = cleanPhone.slice(-10);

    if (loginMethod === "password") {
      if (!password) {
        setLocalError("Please enter your password.");
        return;
      }

      if (onSignInSubmit) {
        try {
          await onSignInSubmit({ identifier: cleanPhone, password, email: email.trim() || undefined });
          submittedRef.current = true;
          setIsSubmitted(true);
          if (typeof window !== "undefined") {
            window.onbeforeunload = null;
          }
        } catch (err: any) {
          setLocalError(err?.message || "Incorrect password. Please try again.");
        }
      }
    } else {
      const code = otp.join("");
      if (code.length < 4) {
        setLocalError("Please enter the 4-digit SMS OTP verification code.");
        return;
      }

      if (onSignInSubmit) {
        try {
          await onSignInSubmit({ identifier: cleanPhone, otp: code, email: email.trim() || undefined });
          submittedRef.current = true;
          setIsSubmitted(true);
          if (typeof window !== "undefined") {
            window.onbeforeunload = null;
          }
        } catch (err: any) {
          setLocalError(err?.message || "Invalid or expired verification code.");
        }
      }
    }
  };

  // Step 2 for New User:
  // 1st click -> CTA is "Verify Account", which validates details and sends SMS OTP
  // 2nd click -> After OTP is sent, CTA is "Verify & Create Account", which completes registration
  const handleNewUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    const cleanPhone = phone.replace(/\D/g, "");
    if (!name.trim()) {
      setLocalError("Please enter your full name.");
      nameInputRef.current?.focus();
      return;
    }
    if (!password || password.length < 6) {
      setLocalError("Password must be at least 6 characters.");
      return;
    }

    // Step 2A: Before OTP is sent, CTA is "Verify Account" to send OTP
    if (!otpSent) {
      await handleSendSmsOtp();
      return;
    }

    // Step 2B: Once OTP is sent, verify and create account
    const code = otp.join("");
    if (code.length < 4) {
      setLocalError("Please enter the 4-digit SMS OTP verification code.");
      return;
    }

    if (onSignUpSubmit) {
      try {
        await onSignUpSubmit({
          name: name.trim(),
          phone: cleanPhone,
          email: email.trim() || undefined,
          password,
          otp: code,
          referralCode: referralCode.trim() ? referralCode.trim().toUpperCase() : undefined,
        });
        submittedRef.current = true;
        setIsSubmitted(true);
        if (typeof window !== "undefined") {
          window.onbeforeunload = null;
        }
      } catch (err: any) {
        setLocalError(err?.message || "Registration failed. Please check the code and try again.");
      }
    }
  };

  // Back to Screen 1 (Only allowed if OTP is NOT yet sent to avoid wasting SMS budget)
  const handleBackToPhone = () => {
    if (otpSent) {
      // Prevent accidental misclick when OTP has already been sent
      toast.info("SMS Code Already Dispatched", {
        description: "Please enter the code sent to your phone or wait for cooldown to change number.",
      });
      return;
    }
    setLocalError(null);
    setStep("phone");
    setTimeout(() => phoneInputRef.current?.focus(), 320);
  };

  const activeError = localError || error;

  return (
    <div className="w-full min-h-screen md:grid md:grid-cols-2 bg-background text-foreground font-sans">
      <style>{`
        input[type="password"]::-ms-reveal,
        input[type="password"]::-ms-clear {
          display: none;
        }
      `}</style>

      {/* Main Authentication Card */}
      <div className="flex min-h-screen items-center justify-center p-6 md:h-auto md:p-8 md:py-12">
        <div className="mx-auto w-full max-w-[380px] flex flex-col gap-5">
          {/* Brand Logo in Auth Header */}
          <div className="flex flex-col items-center justify-center pt-2">
            <Link
              href="/"
              className="inline-flex items-center justify-center mb-1 group transition-transform active:scale-95"
              aria-label="Skywear Brand Home"
            >
              <SkywearLogo size="lg" />
            </Link>
          </div>

          {/* Header Title */}
          <div className="flex flex-col items-center gap-1.5 text-center">
            <h1 className="text-2xl font-bold tracking-tight">
              {step === "phone"
                ? "Sign In or Register"
                : userMode === "login"
                ? "Welcome Back"
                : "Create Account"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {step === "phone"
                ? "Enter your mobile number to get started"
                : userMode === "login"
                ? (existingUserName ? `Signed in as ${existingUserName}` : "Enter your password to sign in")
                : otpSent
                ? "Enter the 4-digit SMS code to verify"
                : "Fill in your details to create your account"}
            </p>
          </div>

          {/* Active Error Banner */}
          {activeError && (
            <div className="p-3 text-xs bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-md font-mono flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{activeError}</span>
            </div>
          )}

          {/* SLIDER CONTAINER (Pure CSS horizontal slide without page reload) */}
          <div className="relative w-full overflow-hidden">
            <div
              className="flex w-full transition-transform duration-300 ease-out"
              style={{
                transform: step === "phone" ? "translateX(0%)" : "translateX(-100%)",
              }}
            >
              {/* ========================================================= */}
              {/* SLIDE 1: ONLY MOBILE NUMBER INPUT                         */}
              {/* ========================================================= */}
              <div className="w-full shrink-0 px-0.5">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    checkAndProceedWithPhone();
                  }}
                  className="grid gap-4"
                >
                  <div className="grid gap-2">
                    <Label htmlFor="auth-phone">Mobile Number</Label>
                    <div className="flex items-center rounded-lg border border-input dark:border-input/50 bg-background focus-within:border-[#00FF66] overflow-hidden transition-colors">
                      <span className="px-3.5 text-xs font-semibold text-muted-foreground border-r border-input flex items-center gap-1.5 bg-muted/30">
                        <span>🇮🇳</span> +91
                      </span>
                      <input
                        ref={phoneInputRef}
                        id="auth-phone"
                        type="tel"
                        maxLength={15}
                        placeholder="9876543210"
                        value={phone}
                        onChange={(e) => {
                          let val = e.target.value.replace(/\D/g, "");
                          if (val.startsWith("91") && val.length > 10) val = val.slice(2);
                          else if (val.startsWith("0") && val.length > 10) val = val.slice(1);
                          if (val.length > 10) val = val.slice(-10);
                          setPhone(val);
                          setLocalError(null);
                          // Instant check when 10 digits are filled
                          if (val.length === 10) {
                            setTimeout(() => checkAndProceedWithPhone(val), 150);
                          }
                        }}
                        required
                        autoFocus
                        className="flex h-11 w-full bg-transparent px-3.5 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none font-mono"
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    variant="default"
                    className="w-full mt-1"
                    disabled={phone.replace(/\D/g, "").length !== 10 || isCheckingPhone}
                  >
                    {isCheckingPhone ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Checking...</span>
                      </>
                    ) : (
                      <>
                        <span>Continue</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </Button>
                </form>
              </div>

              {/* ========================================================= */}
              {/* SLIDE 2: DETAILS SLIDE (LOGIN OR REGISTRATION)            */}
              {/* ========================================================= */}
              <div className="w-full shrink-0 px-0.5">
                {/* Active Phone Pill: If OTP is sent, it is LOCKED to prevent misclick and wasted OTP costs */}
                <div className="mb-4 flex items-center justify-between p-2.5 px-3 bg-muted/50 border border-border rounded-lg text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold text-foreground">
                      🇮🇳 +91 {phone.replace(/\D/g, "").slice(-10)}
                    </span>
                    {otpSent && (
                      <span className="text-[10px] text-[#00FF66] font-mono px-1.5 py-0.5 bg-[#00FF66]/10 border border-[#00FF66]/20 rounded font-semibold">
                        SMS Sent
                      </span>
                    )}
                  </div>
                  {!otpSent ? (
                    <button
                      type="button"
                      onClick={handleBackToPhone}
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground underline transition-colors cursor-pointer"
                    >
                      <ArrowLeft className="w-3 h-3" />
                      <span>Change</span>
                    </button>
                  ) : (
                    <span className="text-[11px] text-muted-foreground font-mono flex items-center gap-1">
                      <Lock className="w-3 h-3" /> Locked
                    </span>
                  )}
                </div>

                {/* --- A. EXISTING USER (LOGIN VIA PASSWORD) --- */}
                {userMode === "login" ? (
                  <form onSubmit={handleSignIn} className="grid gap-4">
                    <div className="grid gap-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="signin-password">Password</Label>
                        <Link
                          href="/forgot-password"
                          className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                        >
                          Forgot password?
                        </Link>
                      </div>
                      <PasswordInput
                        ref={passwordInputRef}
                        id="signin-password"
                        name="password"
                        required
                        placeholder="Enter your password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                    </div>

                    <div className="grid gap-1.5">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="signin-email" className="text-xs text-muted-foreground">
                          Email address <span className="text-[10px] text-muted-foreground/70">(Optional)</span>
                        </Label>
                        {email.trim() && (
                          <span className="text-[10px] font-mono text-[#00FF66] flex items-center gap-1 font-semibold">
                            <CheckCircle2 className="w-3 h-3" /> Auto-filled
                          </span>
                        )}
                      </div>
                      <Input
                        id="signin-email"
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        placeholder="e.g. name@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="text-xs h-9 font-mono"
                      />
                    </div>

                    <Button
                      type="submit"
                      variant="default"
                      className="w-full mt-1"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Signing in...</span>
                        </>
                      ) : (
                        <>
                          <span>Sign In</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </Button>
                  </form>
                ) : (
                  /* --- B. NEW USER (REGISTRATION FORM) --- */
                  <form onSubmit={handleNewUserSubmit} className="grid gap-3.5">
                    <div className="grid gap-1.5">
                      <Label htmlFor="reg-name">Full Name</Label>
                      <Input
                        ref={nameInputRef}
                        id="reg-name"
                        type="text"
                        placeholder="e.g. Rahul Sharma"
                        required
                        disabled={otpSent}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                    </div>

                    <div className="grid gap-1.5">
                      <Label htmlFor="reg-password">Create Password</Label>
                      <PasswordInput
                        id="reg-password"
                        placeholder="Minimum 6 characters"
                        required
                        disabled={otpSent}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                    </div>

                    <div className="grid gap-1.5">
                      <Label htmlFor="reg-email" className="text-xs text-muted-foreground">
                        Email address <span className="text-[10px] text-muted-foreground/70">(Optional)</span>
                      </Label>
                      <Input
                        id="reg-email"
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        placeholder="e.g. name@example.com"
                        disabled={otpSent}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="text-xs h-9 font-mono"
                      />
                    </div>

                    {/* SMS OTP Section: Only reveals after user clicks 'Verify Account' */}
                    {otpSent && (
                      <div className="grid gap-2 pt-2 border-t border-border animate-in fade-in duration-300">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-semibold">Enter 4-Digit SMS Code</Label>
                          <button
                            type="button"
                            disabled={cooldown > 0 || sendingOtp}
                            onClick={() => handleSendSmsOtp()}
                            className="text-xs text-[#00FF66] hover:underline disabled:opacity-50 cursor-pointer font-medium"
                          >
                            {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend SMS"}
                          </button>
                        </div>

                        <div className="space-y-2">
                          <div className="flex justify-center gap-3">
                            {otp.map((digit, idx) => (
                              <input
                                key={idx}
                                ref={(el) => {
                                  otpRefs.current[idx] = el;
                                }}
                                type="text"
                                inputMode="numeric"
                                maxLength={1}
                                value={digit}
                                onChange={(e) => {
                                  const raw = e.target.value.replace(/\D/g, "");
                                  if (raw.length > 1) {
                                    const chars = raw.slice(0, 4).split("");
                                    const next = [...otp];
                                    chars.forEach((c, i) => {
                                      if (i < 4) next[i] = c;
                                    });
                                    setOtp(next);
                                    otpRefs.current[Math.min(chars.length, 3)]?.focus();
                                    return;
                                  }
                                  const val = raw.slice(-1);
                                  const next = [...otp];
                                  next[idx] = val;
                                  setOtp(next);
                                  if (val && idx < 3) otpRefs.current[idx + 1]?.focus();
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Backspace" && !otp[idx] && idx > 0) {
                                    otpRefs.current[idx - 1]?.focus();
                                  }
                                }}
                                className="w-12 h-12 bg-background border-2 border-input focus:border-[#00FF66] rounded-md text-center text-xl font-bold font-mono focus:outline-none transition-colors"
                              />
                            ))}
                          </div>
                          <p className="text-[11px] text-center text-muted-foreground">
                            Code sent via SMS to +91 {phone.replace(/\D/g, "").slice(-10)}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Optional Referral Code Toggle */}
                    {!otpSent && (
                      <div className="pt-0.5">
                        {!showReferral ? (
                          <button
                            type="button"
                            onClick={() => setShowReferral(true)}
                            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Gift className="w-3 h-3" />
                            <span>Have a referral code?</span>
                          </button>
                        ) : (
                          <div className="grid gap-1.5 animate-in fade-in duration-200">
                            <div className="flex items-center justify-between">
                              <Label htmlFor="reg-referral" className="text-xs">
                                Referral Code
                              </Label>
                              {referralCode.trim() && (
                                <span className="text-[10px] font-mono text-[#00FF66] flex items-center gap-1 font-semibold">
                                  <CheckCircle2 className="w-3 h-3" /> VIP Applied
                                </span>
                              )}
                            </div>
                            <Input
                              id="reg-referral"
                              type="text"
                              placeholder="e.g. SKYWEAR-ABCDE"
                              value={referralCode}
                              onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                              className={`font-mono uppercase text-xs h-9 ${referralCode.trim() ? "border-[#00FF66]/50 bg-[#00FF66]/5" : ""}`}
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Main Dynamic CTA Button:
                        Step 1: 'Verify Account' -> sends SMS OTP
                        Step 2: 'Verify & Create Account' -> verifies OTP & logs in */}
                    <Button
                      type="submit"
                      variant="default"
                      className="w-full mt-2"
                      disabled={isLoading || sendingOtp}
                    >
                      {sendingOtp ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Sending SMS Code...</span>
                        </>
                      ) : isLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Creating Account...</span>
                        </>
                      ) : !otpSent ? (
                        <>
                          <span>Verify Account</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      ) : (
                        <>
                          <span>Verify & Create Account</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </Button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Hero / Visual Panel */}
      <div
        className="hidden md:block relative bg-cover bg-center border-l border-border"
        style={{
          backgroundImage: `url(https://images.unsplash.com/photo-1509631179647-0177331693ae?q=80&w=1200&auto=format&fit=crop)`,
        }}
      >
        <div className="absolute inset-0 bg-black/45 backdrop-blur-[1px]" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background to-transparent" />

        <div className="relative z-10 flex h-full flex-col justify-end p-8 pb-14 max-w-lg mx-auto">
          <div className="p-6 bg-background/80 backdrop-blur-md border border-border rounded-lg space-y-3">
            <SkywearLogo size="md" />
            <p className="text-xs text-muted-foreground leading-relaxed pt-1">
              Premium heavyweight streetwear essentials. Manage your orders, tracking, and cashback wallet in one place.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
