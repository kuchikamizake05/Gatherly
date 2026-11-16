"use client";

import { Field } from "@/components/ui/field";
import { Combobox } from "@/components/elements/Combobox";
import { shortProvince, useRegions } from "@/lib/regions";

/**
 * Provinsi lalu Kota atau kabupaten. Pita 13 (Pengajuan organizer) dan 16 (Buat dan edit acara).
 * Nilai yang disimpan nama resmi, misalnya "Daerah Istimewa Yogyakarta" dan "Kabupaten Sleman".
 * Mengganti provinsi mengosongkan kota.
 *
 * Dengan react-hook-form:
 * <RegionFields
 *   value={{ province: watch("province"), regency: watch("regency") }}
 *   onChange={(v) => { setValue("province", v.province, { shouldValidate: true }); setValue("regency", v.regency, { shouldValidate: true }); }}
 *   errors={{ province: errors.province?.message, regency: errors.regency?.message }}
 * />
 */

export type RegionValue = { province: string; regency: string };

type RegionFieldsProps = {
  value: RegionValue;
  onChange: (value: RegionValue) => void;
  onBlur?: (field: keyof RegionValue) => void;
  errors?: Partial<Record<keyof RegionValue, string>>;
  disabled?: boolean;
  /** Awalan id supaya label tetap terhubung bila ada dua isian alamat di satu halaman. */
  idPrefix?: string;
  className?: string;
};

export function RegionFields({ value, onChange, onBlur, errors, disabled, idPrefix = "region", className }: RegionFieldsProps) {
  const { provinces, regencies, loading, failed } = useRegions(value.province);

  return (
    <div className={className ?? "grid gap-4 md:grid-cols-2"}>
      <Field label="Provinsi" htmlFor={`${idPrefix}-province`} error={errors?.province ?? (failed ? "Daftar provinsi gagal dimuat. Muat ulang halaman." : undefined)}>
        <Combobox
          id={`${idPrefix}-province`}
          options={provinces.map((p) => ({ value: p.name, label: shortProvince(p.name) }))}
          value={value.province || undefined}
          onChange={(province) => onChange({ province, regency: province === value.province ? value.regency : "" })}
          onBlur={() => onBlur?.("province")}
          placeholder={loading ? "Memuat…" : "Pilih provinsi"}
          searchPlaceholder="Cari provinsi"
          disabled={disabled || loading || failed}
          invalid={!!errors?.province}
        />
      </Field>
      <Field label="Kota atau kabupaten" htmlFor={`${idPrefix}-regency`} error={errors?.regency}>
        <Combobox
          id={`${idPrefix}-regency`}
          options={regencies.map((r) => ({ value: r, label: r }))}
          value={value.regency || undefined}
          onChange={(regency) => onChange({ province: value.province, regency })}
          onBlur={() => onBlur?.("regency")}
          placeholder={value.province ? "Pilih kota atau kabupaten" : "Pilih provinsi dulu"}
          searchPlaceholder="Cari kota atau kabupaten"
          disabled={disabled || !value.province}
          invalid={!!errors?.regency}
        />
      </Field>
    </div>
  );
}
