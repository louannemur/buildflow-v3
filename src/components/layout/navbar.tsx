"use client";

import Link from "next/link";

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="container flex h-14 items-center">
        <Link href="/" className="text-lg font-semibold">
          BuildFlow
        </Link>
      </div>
    </header>
  );
}
