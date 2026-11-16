import { redirect } from "next/navigation";

/** Halaman pertama admin adalah antrean pengajuan. */
export default function AdminIndex() {
  redirect("/applications");
}
