"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function PortalRedirect() {
  const params = useParams();
  const router = useRouter();

  useEffect(() => {
    const slug = params?.slug;
    const path = Array.isArray(slug) ? slug.join("/") : slug || "orders";
    router.replace(`/account/${path}`);
  }, [params, router]);

  return (
    <div className="min-h-screen bg-[#171816] text-[#F4F1EA] font-mono flex items-center justify-center p-4">
      <span className="text-xs uppercase tracking-widest text-[#77776F]">Redirecting to /account…</span>
    </div>
  );
}
