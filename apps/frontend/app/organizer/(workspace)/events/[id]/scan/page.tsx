import { ScannerView } from "@/modules/check-in/components/ScannerView";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ScannerView eventId={id} />;
}
