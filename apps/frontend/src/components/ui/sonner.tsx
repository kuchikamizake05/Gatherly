"use client";

import { useEffect, useState } from "react";
import { CircleCheck, Info, Loader2, OctagonX, TriangleAlert } from "lucide-react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

/**
 * Toast sesuai komponen Toast di desain: latar ink, teks putih, ikon kuning.
 * Posisi: kanan bawah di tablet dan desktop, tengah atas di mobile.
 * Pemakaian: import { toast } from "sonner"; toast.success("Profil diperbarui").
 */
function useIsMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 767px)");
    const update = () => setMobile(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return mobile;
}

export function Toaster(props: ToasterProps) {
  const mobile = useIsMobile();

  return (
    <Sonner
      theme="light"
      position={mobile ? "top-center" : "bottom-right"}
      offset={mobile ? 62 : 24}
      duration={6000}
      icons={{
        success: <CircleCheck className="size-5 text-primary" />,
        info: <Info className="size-5 text-primary" />,
        warning: <TriangleAlert className="size-5 text-primary" />,
        error: <OctagonX className="size-5 text-red-500" />,
        loading: <Loader2 className="size-5 animate-spin text-primary" />,
      }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "flex w-[calc(100vw-32px)] items-center gap-3 rounded-2xl bg-inverse py-3.5 pr-3.5 pl-[18px] text-inverse-foreground shadow-[0_1px_2px_#1111131a,0_16px_40px_#11111333] md:w-[420px]",
          // Wadah judul dan deskripsi melebar supaya tombol aksi rata kanan.
          content: "flex min-w-0 flex-1 flex-col gap-0.5",
          title: "text-[15px] font-semibold",
          description: "text-sm text-neutral-300",
          actionButton: "ml-auto shrink-0 cursor-pointer text-[15px] font-extrabold text-primary",
          cancelButton: "cursor-pointer text-[15px] font-semibold text-neutral-300",
        },
      }}
      {...props}
    />
  );
}
