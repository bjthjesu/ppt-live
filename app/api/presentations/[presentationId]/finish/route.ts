import { NextResponse } from "next/server";
import { finishPresentation, getPresentation, publishPresentationFinished } from "@/lib/presentation";

type FinishRouteProps = { params: Promise<{ presentationId: string }> };

export async function POST(request: Request, { params }: FinishRouteProps) {
  const { presentationId } = await params;
  const presentation = getPresentation(presentationId);
  if (!presentation) return NextResponse.json({ error: "Presentation not found" }, { status: 404 });

  // Prevent duplicate finishes
  if (presentation.status === "finished") {
    return NextResponse.json({ presentation });
  }

  const updated = finishPresentation(presentationId);
  if (!updated) return NextResponse.json({ error: "Presentation not found" }, { status: 404 });

  // Publish event for server-sent events
  publishPresentationFinished({ type: "PRESENTATION_FINISHED", presentationId });

  return NextResponse.json({ presentation: updated });
}
