import { Button } from "@/components/ui/button";
export function ListPagination({
  page,
  total,
  limit,
  onChange,
  disabled,
}: {
  page: number;
  total: number;
  limit: number;
  onChange: (page: number) => void;
  disabled?: boolean;
}) {
  const pages = Math.max(1, Math.ceil(total / limit));
  return (
    <nav
      aria-label="Halaman daftar"
      className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4"
    >
      <p className="text-sm text-text-secondary">
        {total} hasil · Halaman {page} dari {pages}
      </p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          disabled={disabled || page <= 1}
          onClick={() => onChange(page - 1)}
        >
          Sebelumnya
        </Button>
        <Button
          variant="outline"
          disabled={disabled || page >= pages}
          onClick={() => onChange(page + 1)}
        >
          Berikutnya
        </Button>
      </div>
    </nav>
  );
}
