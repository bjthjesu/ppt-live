import { NextResponse } from "next/server";
import { getPresentation, trackParticipant, untrackParticipant } from "@/lib/presentation";

type JoinRouteProps = { params: Promise<{ presentationId: string }> };

export async function POST(request: Request, { params }: JoinRouteProps) {
  const { presentationId } = await params;
  const body = (await request.json()) as { sessionId?: string };
  
  if (!body.sessionId) {
    return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  }

  const presentation = getPresentation(presentationId);
  if (!presentation) {
    return NextResponse.json({ error: "Presentation not found" }, { status: 404 });
  }

  trackParticipant(presentationId, body.sessionId);
  return NextResponse.json({ presentation });
}

export async function DELETE(request: Request, { params }: JoinRouteProps) {
  const { presentationId } = await params;
  const body = (await request.json()) as { sessionId?: string };
  
  if (!body.sessionId) {
    return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  }

  untrackParticipant(presentationId, body.sessionId);
  return NextResponse.json({ success: true });
}
