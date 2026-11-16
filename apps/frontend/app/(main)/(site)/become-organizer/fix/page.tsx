import { Suspense } from "react";

import { FixApplicationView } from "@/modules/applications/components/ApplicationViews";

/** Perbaiki pengajuan. Pita 13 C. Bisa dibuka dari email dengan ?number=PNG-2609-0042 */
export default function FixApplicationPage() {
  return (
    <Suspense>
      <FixApplicationView />
    </Suspense>
  );
}
