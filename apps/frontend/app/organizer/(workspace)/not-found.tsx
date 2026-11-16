import Link from "next/link";

import { Button } from "@/components/ui/button";
import { StateView } from "@/components/elements/state-view";

export default function NotFound() {
  return (
    <StateView
      illustration="not-found"
      title="Halaman tidak ditemukan"
      description="Tautan mungkin salah ketik atau halamannya sudah tidak tersedia."
      action={
        <Button asChild>
          <Link href="/">Kembali ke dashboard</Link>
        </Button>
      }
    />
  );
}
