"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { RouteStub } from "@/components/elements/route-stub";
import { useVerifyLogin, useVerifyRegister, useResendOtp } from "@/modules/auth/hooks";

function PageContent() {
  const search = useSearchParams();
  // ?challengeId=...&purpose=login|register&returnTo=...
  const purpose = search.get("purpose") ?? "login";
  const verifyLogin = useVerifyLogin();
  const verifyRegister = useVerifyRegister();
  const resend = useResendOtp();
  void verifyLogin; void verifyRegister; void resend;
  return <RouteStub title="Periksa email Anda" band="10" scenario="B3 dan D2. Kode OTP 6 digit" queries={{ purpose: { status: "success", data: purpose } }} />;
}

/** useSearchParams wajib dibungkus Suspense. */
export default function Page() {
  return (
    <Suspense>
      <PageContent />
    </Suspense>
  );
}
