import { Suspense } from "react";

import { VerifyForm } from "@/modules/auth/components/VerifyForm";

/** useSearchParams di dalam form wajib dibungkus Suspense. */
export default function VerifyPage() {
  return (
    <Suspense>
      <VerifyForm />
    </Suspense>
  );
}
