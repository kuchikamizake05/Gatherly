import type { Metadata } from "next";
import { cookies } from "next/headers";

import { ApiError } from "@/lib/api/client";
import { eventsApi } from "@/modules/events/api";
import { EventDetailView } from "@/modules/events/components/EventDetail";
import { EventNotFound } from "@/modules/events/components/EventDetailStates";

type Props = { params: Promise<{ slug: string }> };

async function load(slug: string) {
  const cookie = (await cookies()).toString() || undefined;
  try {
    return (await eventsApi.detail(slug, cookie)).data;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const event = await load(slug).catch(() => null);
  if (!event) return { title: "Acara tidak ditemukan" };
  return { title: event.title, description: event.description.slice(0, 160), openGraph: { images: [event.poster] } };
}

/** Detail acara. Pita 04. */
export default async function EventDetailPage({ params }: Props) {
  const { slug } = await params;
  const event = await load(slug);
  return event ? <EventDetailView initial={event} /> : <EventNotFound />;
}
