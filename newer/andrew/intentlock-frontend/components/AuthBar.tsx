"use client";

import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../lib/authContext";

export function AuthBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  if (pathname === "/login" || !user) return null;

  const handleLogout = () => {
    logout();
    router.replace("/login");
  };

  return (
    <div className="border-b border-border bg-card/50 px-6 py-2 text-sm text-muted-foreground">
      <div className="mx-auto flex max-w-[1800px] items-center justify-between">
        <span>
          Signed in as <span className="font-medium text-foreground">{user.display_name || user.user_id}</span>
        </span>
        <button
          type="button"
          onClick={handleLogout}
          className="rounded-lg border border-border bg-transparent px-3 py-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          Log out
        </button>
      </div>
    </div>
  );
}
