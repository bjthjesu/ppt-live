import { NextResponse } from "next/server";
import { getPresentation, publishSlideChange, updateCurrentSlide, updateSlideCount } from "@/lib/presentation";

type SlideRouteProps = { params: Promise<{ presentationId: string }> };

export async function GET(_request: Request, { params }: SlideRouteProps) {
  const { presentationId } = await params;
  const presentation = getPresentation(presentationId);
  if (!presentation) return NextResponse.json({ error: "Presentation not found" }, { status: 404 });
  return NextResponse.json({ presentation });
}

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
