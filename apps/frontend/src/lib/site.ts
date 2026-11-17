/**
 * Domain Gatherly di satu tempat. Ganti lewat NEXT_PUBLIC_SITE_DOMAIN bila domain berubah.
 * Host organizer dan admin mengikuti awalan "organizer." dan "admin." (lihat proxy.ts),
 * jadi tidak perlu diatur terpisah.
 */
export const SITE_DOMAIN = process.env.NEXT_PUBLIC_SITE_DOMAIN || "gatherlyy.fun";
export const SITE_URL = `https://${SITE_DOMAIN}`;
export const ORGANIZER_HOST = `organizer.${SITE_DOMAIN}`;
export const ORGANIZER_URL = process.env.NEXT_PUBLIC_ORGANIZER_URL || `https://${ORGANIZER_HOST}`;

/** Alamat email tim. */
export const MAIL = {
  halo: `halo@${SITE_DOMAIN}`,
  mitra: `mitra@${SITE_DOMAIN}`,
  it: `it@${SITE_DOMAIN}`,
} as const;

/** Email admin wajib memakai domain ini, sama dengan ADMIN_EMAIL_DOMAIN di backend. */
export const ADMIN_EMAIL_DOMAIN = SITE_DOMAIN;
