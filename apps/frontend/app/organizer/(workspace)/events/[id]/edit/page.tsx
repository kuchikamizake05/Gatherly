import { EventEditor } from "@/modules/organizer-events/components/EventEditor";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EventEditor id={id} />;
}
