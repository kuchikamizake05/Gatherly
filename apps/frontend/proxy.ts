import { NextResponse, type NextRequest } from "next/server";

/**
 * Satu app untuk tiga domain.
 * - organizer.gatherly.xyz (lokal: organizer.localhost:3000) → app/organizer
 * - admin.gatherly.xyz (lokal: admin.localhost:3000) → app/admin
 * - gatherly.xyz (lokal: localhost:3000) → app/(main)
 *
 * Folder organizer dan admin tidak bisa dibuka langsung lewat domain utama.
 */
const APPS = ["organizer", "admin"] as const;

function appFromHost(host: string) {
  const name = host.split(":")[0] ?? "";
  return APPS.find((app) => name.startsWith(`${app}.`)) ?? null;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const app = appFromHost(request.headers.get("host") ?? "");

  if (app) {
    const url = request.nextUrl.clone();
    url.pathname = `/${app}${pathname === "/" ? "" : pathname}`;
    return NextResponse.rewrite(url);
  }

  // Domain utama tidak boleh membuka halaman organizer atau admin secara langsung.
  if (APPS.some((name) => pathname === `/${name}` || pathname.startsWith(`/${name}/`))) {
    return NextResponse.rewrite(new URL("/404", request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Lewati aset, API, dan file statis.
  matcher: ["/((?!api|_next/static|_next/image|favicon|apple-touch-icon|icon-|maskable|site.webmanifest|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)"],
};
