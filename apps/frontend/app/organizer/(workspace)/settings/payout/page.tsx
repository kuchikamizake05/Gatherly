"use client";

import { RouteStub } from "@/components/elements/route-stub";
import { useBankAccount, usePayouts } from "@/modules/organizer-settings/hooks";

export default function Page() {
  const bank = useBankAccount();
  const payouts = usePayouts();
  return <RouteStub title="Rekening pencairan" band="23" scenario="B dan C. Rekening dan pencairan" pendingIssue="B39" queries={{ bank: bank, payouts: payouts }} />;
}
