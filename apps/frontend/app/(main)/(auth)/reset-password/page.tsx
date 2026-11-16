import { Suspense } from "react";

import { ResetPasswordForm } from "@/modules/auth/components/ResetPasswordForm";

/** useSearchParams di dalam form wajib dibungkus Suspense. */
export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
