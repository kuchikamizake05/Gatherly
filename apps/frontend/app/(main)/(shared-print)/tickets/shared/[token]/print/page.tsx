import type { Metadata } from "next";

import { SharedTicketPrintView } from "@/modules/tickets/components/SharedTicketView";

type Props = { params: Promise<{ token: string }> };

export const metadata: Metadata = { title: "E-tiket", robots: { index: false, follow: false } };

/** PDF tiket yang dibagikan. Di luar grup (print) karena tidak butuh login. */
export default async function SharedTicketPrintPage({ params }: Props) {
  const { token } = await params;
  return <SharedTicketPrintView token={token} />;
}
