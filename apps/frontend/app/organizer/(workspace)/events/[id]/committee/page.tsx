import { CommitteeList } from "@/modules/organizer-events/components/CommitteeList";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CommitteeList eventId={id} />;
}
