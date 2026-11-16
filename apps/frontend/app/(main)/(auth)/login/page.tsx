import { Suspense } from "react";

import { LoginForm } from "@/modules/auth/components/LoginForm";

/** useSearchParams di dalam form wajib dibungkus Suspense. */
export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
