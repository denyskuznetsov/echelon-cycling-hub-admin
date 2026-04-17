import React, { Suspense } from "react";
import { requireAnonymous } from "@/src/utils/auth/requireAnonymous";
import { LoginForm } from "./_components/LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: { next?: string };
}) {
  // If already signed in, send the user to their role-based landing (or the
  // explicit ?next= that originally bounced them here).
  await requireAnonymous(searchParams?.next ?? null);

  return (
    <Suspense
      fallback={
        <div className="flex h-screen w-full items-center justify-center">
          Loading...
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
