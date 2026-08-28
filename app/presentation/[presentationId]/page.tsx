import { notFound } from "next/navigation";
import { LivePresentation } from "@/components/LivePresentation";
import { getPresentation } from "@/lib/presentation";

type StudentPageProps = { params: Promise<{ presentationId: string }> };

export default async function StudentPage({ params }: StudentPageProps) {
  const { presentationId } = await params;
  const presentation = getPresentation(presentationId);
  if (!presentation) notFound();
  return <LivePresentation presentation={presentation} mode="student" />;
}
