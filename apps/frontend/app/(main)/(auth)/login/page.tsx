"use client";

import { RouteStub } from "@/components/elements/route-stub";
import { useLogin } from "@/modules/auth/hooks";

export default function Page() {
  // Setelah password benar, lanjut ke /verify?challengeId=...&purpose=login&returnTo=...
  const login = useLogin();
  return <RouteStub title="Masuk ke Gatherly" band="10" scenario="A dan B. Masuk dengan email atau Google" queries={{ login: { status: login.status, data: login.data } }} />;
}
