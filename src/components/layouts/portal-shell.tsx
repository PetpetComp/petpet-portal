"use client";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dialog, DropdownMenu } from "radix-ui";
import {
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronDown,
  PawPrint,
  X,
  UserRound,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { navigation } from "./sidebar/nav-data";

function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="sidebar-nav" aria-label="Main navigation">
      {navigation.map((group) => {
        const Icon = group.icon;
        if (group.href)
          return (
            <Link
              key={group.label}
              href={group.href}
              aria-label={group.label}
              title={group.label}
              onClick={onNavigate}
              className={
                "nav-link " + (pathname.startsWith(group.href) ? "active" : "")
              }
              aria-current={
                pathname.startsWith(group.href) ? "page" : undefined
              }
            >
              <Icon size={19} />
              <span>{group.label}</span>
            </Link>
          );
        return (
          <details
            className="nav-group"
            key={group.label}
            open={
              group.items?.some((item) => pathname.startsWith(item.href)) ||
              undefined
            }
          >
            <summary aria-label={group.label} title={group.label}>
              <Icon size={19} />
              <span>{group.label}</span>
              <ChevronDown size={15} />
            </summary>
            <div className="nav-children">
              {group.items?.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className={pathname === item.href ? "active" : ""}
                  aria-current={pathname === item.href ? "page" : undefined}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </details>
        );
      })}
    </nav>
  );
}

export function PortalShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <div className={collapsed ? "portal sidebar-collapsed" : "portal"}>
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <header className="topbar">
        <div className="brand-area">
          <Dialog.Root open={mobileOpen} onOpenChange={setMobileOpen}>
            <Dialog.Trigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="mobile-menu"
                aria-label="Open navigation"
              >
                <Menu size={21} />
              </Button>
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="dialog-overlay" />
              <Dialog.Content
                className="mobile-drawer"
                aria-describedby={undefined}
              >
                <Dialog.Title className="brand">
                  <PawPrint size={25} />
                  Petpet
                </Dialog.Title>
                <Dialog.Close asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="dialog-close"
                    aria-label="Close navigation"
                  >
                    <X size={20} />
                  </Button>
                </Dialog.Close>
                <Navigation onNavigate={() => setMobileOpen(false)} />
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
          <Link href="/competition" className="brand">
            <span className="brand-symbol">
              <PawPrint size={23} />
            </span>
            Petpet
          </Link>
        </div>
        <div className="topbar-right">
          <span className="workspace-label">
            <span className="status-dot" />
            Competition Operations
          </span>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button className="account-button" aria-label="Open account menu">
                <span className="avatar">LA</span>
                <span className="account-copy">
                  <strong>Lifta Annisa</strong>
                  <small>Race PIC</small>
                </span>
                <ChevronDown size={14} />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                className="dropdown-content"
                align="end"
                sideOffset={12}
              >
                <DropdownMenu.Label className="dropdown-label">
                  Lifta Annisa<small>lifta.annisa@petpet.id</small>
                </DropdownMenu.Label>
                <DropdownMenu.Separator className="dropdown-separator" />
                <DropdownMenu.Item className="dropdown-item">
                  <UserRound size={16} />
                  Race PIC
                  <Check size={15} />
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </header>
      <aside className="desktop-sidebar">
        <div className="sidebar-caption">
          WORKSPACE
          <Button
            variant="ghost"
            size="icon"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? (
              <PanelLeftOpen size={18} />
            ) : (
              <PanelLeftClose size={18} />
            )}
          </Button>
        </div>
        <Navigation />
        <div className="sidebar-bottom">
          <span className="status-dot" />
          All systems operational<small>Petpet Portal / 2026</small>
        </div>
      </aside>
      <div className="content-shell">
        <main id="main-content" className="page-content">
          {children}
        </main>
        <footer className="portal-footer">
          <span>
            <strong>Petpet</strong> Competition Operations
          </span>
          <span>2026 Petpet</span>
        </footer>
      </div>
    </div>
  );
}
