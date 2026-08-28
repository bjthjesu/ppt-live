import { notFound } from "next/navigation";
import { LivePresentation } from "@/components/LivePresentation";
import { getPresentation } from "@/lib/presentation";

type HostPageProps = { params: Promise<{ presentationId: string }> };

export default async function HostPage({ params }: HostPageProps) {
  const { presentationId } = await params;
  const presentation = getPresentation(presentationId);
  if (!presentation) notFound();
  return <LivePresentation presentation={presentation} mode="host" />;
}
