import { Suspense } from "react";
import { SetupChoresPageContent } from "./SetupChoresPageContent";

export default function SetupChoresPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-slate-500">Loading…</div>
      }
    >
      <SetupChoresPageContent />
    </Suspense>
  );
}
