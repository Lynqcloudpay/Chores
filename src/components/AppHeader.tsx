"use client";

type Props = {
  displayName?: string;
  /** Optional — small help control opens rules modal from dashboard */
  onHelp?: () => void;
};

export function AppHeader({ displayName, onHelp }: Props) {
  const initial = displayName?.trim()?.[0]?.toUpperCase() ?? "?";

  return (
    <header className="sticky top-0 z-40 w-full border-b border-outline-variant/10 bg-surface/90 backdrop-blur-md dark:bg-gray-900/85">
      <div className="mx-auto flex w-full max-w-2xl items-center justify-between px-3 py-2.5 sm:px-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-surface-container-highest text-sm font-bold text-on-surface">
            {initial}
          </div>
          <span className="font-headline text-base font-extrabold italic tracking-tight text-on-surface dark:text-white">
            Equity Engine
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {onHelp ? (
            <button
              type="button"
              onClick={onHelp}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-outline-variant/25 bg-surface-container-lowest text-base font-bold text-primary shadow-sm transition hover:bg-surface-container-high active:scale-95"
              aria-label="How it works"
              title="How it works"
            >
              ?
            </button>
          ) : null}
          <button
            type="button"
            className="text-on-surface-variant transition-opacity hover:opacity-80 active:scale-95 dark:text-gray-300"
            aria-label="Notifications"
          >
            <span className="material-symbols-outlined">notifications</span>
          </button>
        </div>
      </div>
    </header>
  );
}
