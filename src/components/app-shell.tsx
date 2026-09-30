"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Focus, Home, Settings } from "lucide-react";
import { Brand } from "@/components/brand";
import { useLab } from "@/components/lab-provider";

const items = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/focus", label: "Focus", icon: Focus },
  { href: "/stats", label: "Stats", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { state, partnerOnline } = useLab();
  const partners = state?.partners ?? [];
  const onlineCount = partners.filter((partner) => partnerOnline[partner.id]).length;
  const partnerLabel = partners.length === 0
    ? "Solo mode"
    : partners.length === 1
      ? partners[0].name
      : `${onlineCount}/${partners.length} partners online`;

  return <div className="lab-shell">
    <header className="topnav"><div className="lab-container topnav-inner"><Link href="/home"><Brand compact /></Link><nav className="nav-links">{items.map(({href,label})=><Link key={href} className={`nav-link ${path===href?"active":""}`} href={href}>{label}</Link>)}</nav><div className="desktop-actions flex items-center gap-3"><span className="text-xs muted">{partners.length>0&&<span className={`status-dot mr-2 ${onlineCount>0?"":"offline"}`}/>} {partnerLabel}</span><span className="kbd-pill">{state?.profile?.display_name ?? "Focus friend"}</span></div></div></header>
    {children}
    <nav className="mobile-nav">{items.map(({href,label,icon:Icon})=><Link key={href} className={path===href?"active":""} href={href}><Icon size={18}/><span>{label}</span></Link>)}</nav>
  </div>;
}
