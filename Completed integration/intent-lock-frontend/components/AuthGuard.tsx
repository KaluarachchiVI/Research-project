"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../lib/authContext";

const PUBLIC_PATHS = ["/login"];

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname?.startsWith(`${p}/`));

  useEffect(() => {
    if (loading) return;
    if (isPublic) return;
    if (!user) {
      router.replace("/login");
      return;
    }
  }, [loading, user, isPublic, router]);

  if (loading && !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }
  if (!isPublic && !user) {
    return null;
  }

  return <>{children}</>;
}
