"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";

const links = [
  { href: "/", label: "Home" },
  { href: "/play", label: "Play" },
  { href: "/config", label: "Config" },
];

export function NavBar() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-4 border-b-2 px-4 py-3">
      <Button variant="link" asChild className="font-head text-base font-bold no-underline">
        <Link href="/">Omnia</Link>
      </Button>
      <div className="flex gap-1">
        {links.map((link) => (
          <Button
            key={link.href}
            variant={pathname === link.href ? "default" : "ghost"}
            size="sm"
            asChild
          >
            <Link href={link.href}>{link.label}</Link>
          </Button>
        ))}
      </div>
    </nav>
  );
}
