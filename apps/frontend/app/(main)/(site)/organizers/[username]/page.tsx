import type { Metadata } from "next";

import { eventsApi } from "@/modules/events/api";
import { OrganizerProfileView } from "@/modules/events/components/OrganizerProfile";

type Props = { params: Promise<{ username: string }> };

/** Judul tab dan pratinjau tautan saat profil dibagikan. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  try {
    const { data } = await eventsApi.organizerProfile(username);
    return { title: `${data.name} di Gatherly`, description: data.description };
  } catch {
    return { title: "Penyelenggara di Gatherly" };
  }
}

/** Profil publik penyelenggara. Pita 09. */
export default async function OrganizerProfilePage({ params }: Props) {
  const { username } = await params;
  return <OrganizerProfileView username={username} />;
}
