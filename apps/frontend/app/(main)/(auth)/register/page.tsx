import { Suspense } from "react";

import { RegisterForm } from "@/modules/auth/components/RegisterForm";

/** useSearchParams di dalam form wajib dibungkus Suspense. */
export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}
