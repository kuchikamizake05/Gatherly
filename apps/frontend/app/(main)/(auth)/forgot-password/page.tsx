import { Suspense } from "react";

import { ForgotPasswordForm } from "@/modules/auth/components/ForgotPasswordForm";

/** useSearchParams di dalam form wajib dibungkus Suspense. */
export default function ForgotPasswordPage() {
  return (
    <Suspense>
      <ForgotPasswordForm />
    </Suspense>
  );
}
