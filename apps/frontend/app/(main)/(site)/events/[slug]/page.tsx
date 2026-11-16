import type { Metadata } from "next";

import { RouteStub } from "@/components/elements/RouteStub";
import { eventsApi } from "@/modules/events/api";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { data } = await eventsApi.detail(slug);
  return { title: data.title, description: data.description.slice(0, 160) };
}

/** Detail acara. Pilih tiket, simpan, bagikan, laporkan acara. */
export default async function EventDetailPage({ params }: Props) {
  const { slug } = await params;
  const { data: event } = await eventsApi.detail(slug);
  return <RouteStub title={event.title} band="04" pendingIssue="#3 B10" data={{ event }} />;
}
