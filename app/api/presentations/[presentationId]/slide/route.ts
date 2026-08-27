import { NextResponse } from "next/server";
import { publishSlideChange } from "@/lib/presentation/events";
import { getPresentation, updateCurrentSlide, updateSlideCount } from "@/lib/presentation/store";

type SlideRouteProps = { params: Promise<{ presentationId: string }> };

export async function PUT(request: Request, { params }: SlideRouteProps) {
  const { presentationId } = await params;
  const body = (await request.json()) as { slideNumber?: unknown; slideCount?: unknown };
  const presentation = getPresentation(presentationId);
  if (!presentation) return NextResponse.json({ error: "Presentation not found" }, { status: 404 });

  if (typeof body.slideCount === "number" && body.slideCount > 0) updateSlideCount(presentationId, Math.floor(body.slideCount));
  if (typeof body.slideNumber !== "number") return NextResponse.json({ presentation: getPresentation(presentationId) });
  const updated = updateCurrentSlide(presentationId, Math.floor(body.slideNumber));
  if (!updated) return NextResponse.json({ error: "Presentation not found" }, { status: 404 });
  publishSlideChange({ type: "SLIDE_CHANGED", presentationId, slideNumber: updated.currentSlide });
  return NextResponse.json({ presentation: updated });
}
