"use client";

import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";

import { useLogout } from "./hooks";

/** Halaman yang butuh login peserta. Setelah keluar dari sini, pengguna diarahkan ke beranda. */
const PROTECTED = [/^\/account/, /^\/tickets/, /^\/checkout/, /^\/orders\//];

/**
 * Keluar dari akun (pita 12 G). Dipakai menu akun dan halaman Akun saya.
 * Di halaman publik pengguna tetap di halaman yang sama sebagai tamu (G2).
 */
export function useSignOut() {
  const logout = useLogout();
  const router = useRouter();
  const pathname = usePathname();
  return {
    signOut: () =>
      logout.mutate(undefined, {
        onSuccess: () => {
          toast("Anda telah keluar");
          if (PROTECTED.some((re) => re.test(pathname))) router.replace("/");
          else router.refresh();
        },
        onError: () => toast.error("Gagal keluar. Coba lagi."),
      }),
    pending: logout.isPending,
  };
}
