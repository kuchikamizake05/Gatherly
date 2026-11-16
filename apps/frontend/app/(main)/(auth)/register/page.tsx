"use client";

import { RouteStub } from "@/components/elements/route-stub";
import { useRegister } from "@/modules/auth/hooks";

export default function Page() {
  const register = useRegister();
  return <RouteStub title="Buat akun" band="10" scenario="D. Daftar" queries={{ register: { status: register.status, data: register.data } }} />;
}
