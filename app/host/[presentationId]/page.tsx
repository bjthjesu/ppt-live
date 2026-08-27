import { notFound } from "next/navigation";
import { LivePresentation } from "@/components/presentation/LivePresentation";
import { getPresentation } from "@/lib/presentation/store";

type HostPageProps = { params: Promise<{ presentationId: string }> };

export default async function HostPage({ params }: HostPageProps) {
  const { presentationId } = await params;
  const presentation = getPresentation(presentationId);
  if (!presentation) notFound();
  return <LivePresentation presentation={presentation} mode="host" />;
}
