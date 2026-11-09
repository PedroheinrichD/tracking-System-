import { Suspense } from "react";
import { LogoutButton } from "@/components/layout/logout-button";
import { Sidebar } from "@/components/layout/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { ToastProvider } from "@/components/ui/toast";
import { requireUser } from "@/server/auth/dal";

async function UserBlock() {
  const user = await requireUser();
  const initials = user.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <div className="flex items-center gap-3 rounded-lg px-1 py-1">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-soft font-mono text-[13px] font-semibold text-primary-ink">
        {initials || "?"}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-ink">{user.name}</span>
        <span className="block truncate text-xs text-ink-3">{user.email}</span>
      </span>
      <LogoutButton />
    </div>
  );
}

function UserBlockFallback() {
  return (
    <div className="flex items-center gap-3 px-1 py-1">
      <Skeleton className="size-9 rounded-lg" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-2.5 w-32" />
      </div>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <div className="min-h-dvh lg:grid lg:grid-cols-[256px_minmax(0,1fr)]">
        <Sidebar
          userSlot={
            <Suspense fallback={<UserBlockFallback />}>
              <UserBlock />
            </Suspense>
          }
        />
        <main className="mx-auto w-full max-w-[1200px] px-4 pb-16 pt-6 sm:px-6 lg:px-10 lg:pt-10">{children}</main>
      </div>
    </ToastProvider>
  );
}
