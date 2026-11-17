import type { Metadata } from "next";

import { SharedTicketView } from "@/modules/tickets/components/SharedTicketView";

type Props = { params: Promise<{ token: string }> };

// Tautan berisi token pribadi, jadi tidak boleh diindeks mesin pencari.
export const metadata: Metadata = { title: "E-tiket", robots: { index: false, follow: false } };

/** Tiket yang dibagikan lewat email e-tiket, tanpa login. Pita 06 baris I. */
export default async function SharedTicketPage({ params }: Props) {
  const { token } = await params;
  return <SharedTicketView token={token} />;
}
