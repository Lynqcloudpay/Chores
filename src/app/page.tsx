import { Suspense } from "react";
import { DashboardPage } from "@/components/DashboardPage";

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-surface" aria-hidden />}>
      <DashboardPage />
    </Suspense>
  );
}
