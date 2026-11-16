import { RouteStub } from "@/components/elements/route-stub";
import { eventsApi } from "@/modules/events/api";

type Props = { params: Promise<{ username: string }> };

/** Profil publik penyelenggara. */
export default async function OrganizerProfilePage({ params }: Props) {
  const { username } = await params;
  const { data: profile } = await eventsApi.organizerProfile(username);
  return <RouteStub title={profile.name} band="09" pendingIssue="B37" data={{ profile }} />;
}
