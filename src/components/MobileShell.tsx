"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavKey = "dashboard" | "logs" | "history" | "account";

type Props = {
  children: React.ReactNode;
  active: NavKey;
  onAddContribution?: () => void;
};

const items: { key: NavKey; href: string; label: string; icon: string }[] = [
  { key: "dashboard", href: "/", label: "Home", icon: "home" },
  { key: "logs", href: "/#activity-log", label: "Logs", icon: "list_alt" },
  { key: "history", href: "/history", label: "History", icon: "calendar_month" },
];

function NavIcon({ name, active }: { name: string; active: boolean }) {
  return (
    <span
      className="material-symbols-rounded text-[22px] leading-none"
      style={{
        fontVariationSettings: active
          ? "'FILL' 1, 'wght' 500, 'GRAD' 0, 'opsz' 24"
          : "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24",
      }}
      aria-hidden
    >
      {name}
    </span>
  );
}

function scrollToActivityLog() {
  document.getElementById("activity-log")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function MobileShell({ children, active, onAddContribution }: Props) {
  const pathname = usePathname();
  const accountOn = pathname === "/account" || active === "account";

  const tab = (isOn: boolean) =>
    `flex min-h-[48px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-1 text-[10px] font-semibold transition-colors ${
      isOn ? "text-primary" : "text-on-surface-variant"
    }`;

  const addBtn =
    "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary shadow-sm active:opacity-90";

  const AddControl =
    onAddContribution != null ? (
      <button type="button" onClick={onAddContribution} className={addBtn} aria-label="Add contribution">
        <span
          className="material-symbols-rounded text-[24px] leading-none"
          style={{ fontVariationSettings: "'FILL' 1, 'wght' 500, 'GRAD' 0, 'opsz' 24" }}
        >
          add
        </span>
      </button>
    ) : (
      <Link href="/?open=contribution" className={addBtn} aria-label="Add contribution" scroll={false}>
        <span
          className="material-symbols-rounded text-[24px] leading-none"
          style={{ fontVariationSettings: "'FILL' 1, 'wght' 500, 'GRAD' 0, 'opsz' 24" }}
        >
          add
        </span>
      </Link>
    );

  return (
    <div className="min-h-screen bg-surface pb-24 text-on-surface">
      {children}

      <nav
        className="fixed bottom-0 left-0 right-0 z-50 border-t border-outline-variant/20 bg-surface-container-lowest dark:bg-gray-900"
        style={{ paddingBottom: "max(0.25rem, env(safe-area-inset-bottom))" }}
        aria-label="Main"
      >
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between gap-1 px-2">
          {items.slice(0, 2).map((item) => {
            const isAct = item.key === active;
            return (
              <Link
                key={item.key}
                href={item.href}
                className={tab(isAct)}
                scroll={item.key !== "logs"}
                onClick={
                  item.key === "logs"
                    ? (e) => {
                        if (pathname === "/") {
                          e.preventDefault();
                          scrollToActivityLog();
                          window.history.replaceState(null, "", "/#activity-log");
                        }
                      }
                    : undefined
                }
              >
                <NavIcon name={item.icon} active={isAct} />
                <span className="max-w-[64px] truncate">{item.label}</span>
              </Link>
            );
          })}

          <div className="flex flex-1 justify-center">{AddControl}</div>

          {items.slice(2).map((item) => {
            const isAct = item.key === active;
            return (
              <Link key={item.key} href={item.href} className={tab(isAct)} scroll>
                <NavIcon name={item.icon} active={isAct} />
                <span className="max-w-[64px] truncate">{item.label}</span>
              </Link>
            );
          })}

          <Link href="/account" className={tab(accountOn)} aria-label="Account">
            <NavIcon name="manage_accounts" active={accountOn} />
            <span className="max-w-[64px] truncate">Account</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
