"use client";
import { Fragment, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dialog, DropdownMenu } from "radix-ui";
import Image from "next/image";
import {
  ChevronDown,
  ChevronsUpDown,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { navigation, visibleNavigation } from "./sidebar/nav-data";
import { useSidebarContext } from "./sidebar/sidebar-context";

import { usePortalData } from "@/components/providers/portal-data-provider";
import { useAuth } from "@/hooks/use-auth";
import { useCapabilities } from "@/hooks/use-capabilities";
import { toast } from "sonner";
function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { can } = useAuth();
  const { isSponsor } = useCapabilities();
  const visible = visibleNavigation(navigation, { can, isSponsor });
  return (
    <nav className="sidebar-nav" aria-label="Main navigation">
      {visible.map((group, index) => (
        <Fragment key={group.label}>
          {group.section && group.section !== visible[index - 1]?.section && (
            <p className="nav-section">
              {group.section === "Transitional" ? "Other" : group.section}
            </p>
          )}
          {renderGroup(group)}
        </Fragment>
      ))}
    </nav>
  );
  function renderGroup(group: (typeof visible)[number]) {
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
          aria-current={pathname.startsWith(group.href) ? "page" : undefined}
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
  }
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      href="/event-management"
      aria-label="Petpet home"
      className="shell-brand"
    >
      {compact ? (
        <Image
          src="/brand/petpet-icon.png"
          alt=""
          width={36}
          height={36}
          priority
        />
      ) : (
        <Image
          src="/brand/petpet-logo-horizontal.png"
          alt="petpet"
          width={117}
          height={44}
          priority
        />
      )}
    </Link>
  );
}

/** Avatar + name; opens a menu with the role and Sign out. */
function AccountMenu({ compact = false }: { compact?: boolean }) {
  const { user, logout } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const initials =
    user?.name
      .split(" ")
      .slice(0, 2)
      .map((word) => word[0])
      .join("") || "P";
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className="shell-account" aria-label="Open account menu">
          <span className="avatar">{initials}</span>
          {!compact && (
            <>
              <span className="shell-account-copy">
                <strong>{user?.name}</strong>
                <small>{user?.role}</small>
              </span>
              <ChevronsUpDown size={15} aria-hidden />
            </>
          )}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="dropdown-content"
          side={compact ? "bottom" : "top"}
          align={compact ? "end" : "start"}
          sideOffset={8}
        >
          <DropdownMenu.Label className="dropdown-label">
            {user?.name}
            <small>{user?.email}</small>
            <small>{user?.role}</small>
          </DropdownMenu.Label>
          <DropdownMenu.Separator className="dropdown-separator" />
          <DropdownMenu.Item
            className="dropdown-item"
            disabled={signingOut}
            onSelect={async (event) => {
              event.preventDefault();
              setSigningOut(true);
              try {
                await logout();
              } catch (cause) {
                toast.error(
                  cause instanceof Error
                    ? cause.message
                    : "Unable to sign out.",
                );
                setSigningOut(false);
              }
            }}
          >
            <LogOut size={16} aria-hidden />
            {signingOut ? "Signing out..." : "Sign out"}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export function PortalShell({ children }: { children: ReactNode }) {
  const { errors, refresh } = usePortalData();
  const { isOpen, toggleSidebar } = useSidebarContext();
  const collapsed = !isOpen;
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <div className={collapsed ? "portal sidebar-collapsed" : "portal"}>
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      {/* Phones only: the sidebar becomes a drawer behind this bar. */}
      <header className="topbar">
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
              <Dialog.Title className="sr-only">Navigation</Dialog.Title>
              <Brand />
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
        <Brand />
        <AccountMenu compact />
      </header>
      <aside className="desktop-sidebar">
        <div className="sidebar-head">
          <Brand compact={collapsed} />
          <Button
            variant="ghost"
            size="icon"
            className="sidebar-toggle"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={toggleSidebar}
          >
            {collapsed ? (
              <PanelLeftOpen size={18} />
            ) : (
              <PanelLeftClose size={18} />
            )}
          </Button>
        </div>
        <Navigation />
        <div className="sidebar-account">
          <AccountMenu compact={collapsed} />
        </div>
      </aside>
      <div className="content-shell">
        <main id="main-content" className="page-content">
          {Object.keys(errors).length > 0 && (
            <section className="form-section mb-4" role="alert">
              <h2>Some data could not be loaded</h2>
              <ul>
                {Object.entries(errors).map(([collection, message]) => (
                  <li key={collection}>
                    {collection}: {message}
                  </li>
                ))}
              </ul>
              <Button variant="secondary" onClick={() => void refresh()}>
                Retry loading
              </Button>
            </section>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
