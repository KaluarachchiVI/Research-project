"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useNavigationTransition } from "../lib/navigationTransitionContext";

interface AnimatedLinkProps
  extends Omit<React.ComponentProps<typeof Link>, "href"> {
  href: string;
}

/**
 * Link that triggers dashboard exit animations before navigating.
 * Prefetches the target route on click so the next page loads during the exit animation.
 */
export function AnimatedLink({ href, onClick, children, ...rest }: AnimatedLinkProps) {
  const router = useRouter();
  const { exitingTo, startExit } = useNavigationTransition();
  const isExiting = exitingTo != null;

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (isExiting) {
      e.preventDefault();
      return;
    }
    e.preventDefault();
    router.prefetch(href);
    startExit(href);
    onClick?.(e);
  };

  return (
    <Link
      href={href}
      onClick={handleClick}
      aria-busy={isExiting}
      {...rest}
    >
      {children}
    </Link>
  );
}
