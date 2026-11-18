import { Suspense } from "react";

import { VerifyEmailView } from "@/modules/applications/components/VerifyEmailView";

/** Verifikasi email penanggung jawab. Dibuka dari tautan email dengan ?token=... */
export default function VerifyApplicationEmailPage() {
  return (
    <Suspense>
      <VerifyEmailView />
    </Suspense>
  );
}
