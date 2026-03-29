"use client";

type Props = {
  onClick: () => void;
};

/** Floating + only — opens contribution modal */
export function AddContributionFab({ onClick }: Props) {
  return (
    <button
      type="button"
      id="add-contribution"
      onClick={onClick}
      className="fixed bottom-24 right-4 z-[45] flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-container text-on-primary shadow-[0_10px_28px_-4px_rgba(0,108,74,0.32)] transition-transform active:scale-95 sm:bottom-28 sm:right-6"
      aria-label="Add contribution"
    >
      <span
        className="material-symbols-outlined select-none text-[28px] leading-none"
        style={{ fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}
      >
        add
      </span>
    </button>
  );
}
