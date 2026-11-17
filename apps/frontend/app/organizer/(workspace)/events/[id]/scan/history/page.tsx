import { CheckInHistory } from "@/modules/check-in/components/CheckInHistory";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CheckInHistory eventId={id} />;
}
