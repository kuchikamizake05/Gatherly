import { cn } from "@/lib/utils";

/**
 * Blur yang memudar bertahap, seperti "Progressive blur" di desain.
 * Beberapa lapisan backdrop-blur, makin kuat ke arah tepi `side`, tiap lapisan dimasker gradien
 * supaya tidak ada garis batas. Ditambah gradien latar tipis agar teks di atasnya tetap terbaca.
 * Pasang di dalam elemen relative. Tidak menangkap klik.
 */
const LAYERS = [
  { blur: "backdrop-blur-[1px]", stops: [0, 12.5, 37.5, 50] },
  { blur: "backdrop-blur-[2px]", stops: [12.5, 25, 50, 62.5] },
  { blur: "backdrop-blur-[4px]", stops: [25, 37.5, 62.5, 75] },
  { blur: "backdrop-blur-[8px]", stops: [37.5, 50, 75, 87.5] },
  { blur: "backdrop-blur-[16px]", stops: [50, 62.5, 87.5, 100] },
];

export function ProgressiveBlur({ side = "top", className }: { side?: "top" | "bottom"; className?: string }) {
  // Gradien mask dihitung dari tepi yang jauh (tanpa blur) ke tepi `side` (blur penuh).
  const dir = side === "top" ? "to top" : "to bottom";
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-x-0", className)}>
      {LAYERS.map(({ blur, stops: [a, b, c, d] }) => (
        <div
          key={blur}
          className={cn("absolute inset-0", blur)}
          style={{
            maskImage: `linear-gradient(${dir}, transparent ${a}%, black ${b}%, black ${c}%, transparent ${d}%)`,
            WebkitMaskImage: `linear-gradient(${dir}, transparent ${a}%, black ${b}%, black ${c}%, transparent ${d}%)`,
          }}
        />
      ))}
      <div
        className="absolute inset-0"
        style={{ background: `linear-gradient(${dir}, transparent, rgb(255 255 255 / 0.7) 55%, rgb(255 255 255 / 0.85))` }}
      />
    </div>
  );
}
