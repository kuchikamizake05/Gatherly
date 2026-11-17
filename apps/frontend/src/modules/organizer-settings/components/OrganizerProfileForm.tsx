"use client";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/elements/PageHeader";
import { QueryState } from "@/components/elements/QueryState";
import {
  FileUpload,
  type UploadedFile,
} from "@/components/elements/FileUpload";
import { Alert } from "@/components/elements/Alert";
import { useOnline } from "@/hooks/use-online";
import { useWorkspaceMe } from "@/modules/organizer-auth/hooks";
import { useOrgProfile, useUpdateOrgProfile } from "../hooks";
import type { OrganizerProfileSettings } from "../api";
import { SITE_URL } from "@/lib/site";

const schema = z.object({
  name: z.string().trim().min(1, "Nama organizer wajib diisi").max(100),
  city: z.string().trim().min(1, "Kota wajib diisi"),
  description: z.string().max(500, "Maksimal 500 karakter"),
  links: z
    .array(
      z
        .object({
          type: z.string().min(1),
          url: z.string().trim().min(1, "Tautan wajib diisi"),
        })
        .superRefine((link, ctx) => {
          const valid =
            link.type === "email"
              ? z
                  .string()
                  .email()
                  .safeParse(link.url.replace(/^mailto:/i, "")).success
              : z.string().url().safeParse(link.url).success &&
                /^https?:\/\//i.test(link.url);
          if (!valid)
            ctx.addIssue({
              code: "custom",
              path: ["url"],
              message:
                link.type === "email"
                  ? "Masukkan alamat email yang valid"
                  : "Gunakan URL lengkap berawalan http atau https",
            });
        }),
    )
    .max(5),
});
export function OrganizerProfileForm() {
  const profile = useOrgProfile();
  if (profile.isPending || profile.isError)
    return (
      <QueryState
        loading={profile.isPending}
        error={profile.error}
        retry={profile.refetch}
      />
    );
  return <ProfileForm profile={profile.data} />;
}
function ProfileForm({ profile }: { profile: OrganizerProfileSettings }) {
  const save = useUpdateOrgProfile();
  const me = useWorkspaceMe();
  const online = useOnline();
  const disabled = !online || !!me.data?.organizer.frozen || save.isPending;
  const [file, setFile] = useState<File | null>(null);
  const [upload, setUpload] = useState<UploadedFile | null>(
    profile.logoUrl
      ? {
          id: "current",
          name: "Logo organizer",
          size: 0,
          type: "image/png",
          url: profile.logoUrl,
        }
      : null,
  );
  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    mode: "onBlur",
    defaultValues: {
      ...profile,
      links: profile.links.map((link) => ({
        ...link,
        url:
          link.type === "email" || /^https?:\/\//i.test(link.url)
            ? link.url
            : `https://${link.url}`,
      })),
    },
  });
  const links = useFieldArray({ control, name: "links" });
  useEffect(() => {
    const url = upload?.url;
    return () => {
      if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
    };
  }, [upload?.url]);
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-6 p-4 md:p-8">
      <PageHeader
        title="Profil organizer"
        description="Informasi ini ditampilkan pada halaman publik organizer Anda."
        actions={
          <Button variant="outline" asChild>
            <a
              href={`${SITE_URL}/organizers/${profile.username}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Lihat halaman publik
            </a>
          </Button>
        }
      />
      <form
        className="space-y-6 rounded-lg bg-background p-4 pb-24 md:p-6"
        noValidate
        onSubmit={handleSubmit((values) => {
          const form = new FormData();
          form.set("name", values.name);
          form.set("city", values.city);
          form.set("description", values.description);
          form.set("links", JSON.stringify(values.links));
          if (file) form.set("logo", file);
          if (!upload) form.set("removeLogo", "true");
          save.mutate(form, {
            onSuccess: () => {
              setFile(null);
              toast.success("Profil organizer disimpan");
            },
          });
        })}
      >
        {save.error && (
          <Alert title="Profil belum tersimpan">{save.error.message}</Alert>
        )}
        <div className="max-w-xl space-y-4">
          {upload?.url && (
            <Image
              src={upload.url}
              alt="Logo organizer"
              width={96}
              height={96}
              unoptimized
              className="size-24 rounded-lg object-cover"
            />
          )}
          <FileUpload
            label="Logo organizer"
            accept={["image/jpeg", "image/png", "image/webp"]}
            hint="JPG, PNG, atau WEBP maksimal 1 MB."
            disabled={disabled}
            value={upload}
            onChange={(value) => {
              setUpload(value);
              if (!value) setFile(null);
            }}
            upload={async (image, { onProgress, signal }) => {
              if (signal.aborted) throw new Error("Unggahan dibatalkan");
              setFile(image);
              onProgress(100);
              return {
                id: image.name,
                name: image.name,
                size: image.size,
                type: image.type,
                url: URL.createObjectURL(image),
              };
            }}
          />
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <Field
            label="Nama organizer"
            htmlFor="profile-name"
            error={errors.name?.message}
          >
            <Input
              id="profile-name"
              disabled={disabled}
              {...register("name")}
            />
          </Field>
          <Field
            label="Username"
            htmlFor="profile-username"
            helper="Username tidak dapat diubah."
          >
            <Input id="profile-username" value={profile.username} readOnly />
          </Field>
          <Field
            label="Kota"
            htmlFor="profile-city"
            error={errors.city?.message}
          >
            <Input
              id="profile-city"
              disabled={disabled}
              {...register("city")}
            />
          </Field>
        </div>
        <Field
          label="Deskripsi organizer"
          htmlFor="profile-description"
          error={errors.description?.message}
          helper={`${watch("description").length}/500 karakter`}
        >
          <Textarea
            id="profile-description"
            rows={5}
            disabled={disabled}
            {...register("description")}
          />
        </Field>
        <fieldset className="space-y-4">
          <legend className="mb-3 font-bold">Tautan publik</legend>
          {links.fields.map((link, index) => (
            <div
              key={link.id}
              className="grid items-start gap-3 md:grid-cols-[160px_1fr_auto]"
            >
              <Field label="Jenis tautan" htmlFor={`link-type-${index}`}>
                <select
                  id={`link-type-${index}`}
                  className="min-h-11 rounded-md border border-border bg-background px-3 text-sm"
                  disabled={disabled}
                  {...register(`links.${index}.type`)}
                >
                  {[
                    "website",
                    "instagram",
                    "tiktok",
                    "youtube",
                    "x",
                    "facebook",
                    "email",
                  ].map((type) => (
                    <option key={type}>{type}</option>
                  ))}
                </select>
              </Field>
              <Field
                label="URL"
                htmlFor={`link-url-${index}`}
                error={errors.links?.[index]?.url?.message}
              >
                <Input
                  id={`link-url-${index}`}
                  type="url"
                  placeholder="https://"
                  disabled={disabled}
                  {...register(`links.${index}.url`)}
                />
              </Field>
              <Button
                className="md:mt-6"
                type="button"
                variant="danger"
                disabled={disabled}
                onClick={() => links.remove(index)}
              >
                Hapus tautan
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            disabled={disabled || links.fields.length >= 5}
            onClick={() => links.append({ type: "website", url: "" })}
          >
            Tambah tautan ({links.fields.length}/5)
          </Button>
        </fieldset>
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background p-4 md:static md:border-0 md:p-0">
          <Button
            className="w-full md:w-auto"
            type="submit"
            disabled={disabled}
          >
            {save.isPending ? "Menyimpan…" : "Simpan profil"}
          </Button>
        </div>
      </form>
    </div>
  );
}
