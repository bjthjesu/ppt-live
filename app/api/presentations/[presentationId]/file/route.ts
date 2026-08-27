import { NextResponse } from "next/server";
import { getPresentationFile } from "@/lib/presentation/store";

type FileRouteProps = { params: Promise<{ presentationId: string }> };

export async function GET(_request: Request, { params }: FileRouteProps) {
  const { presentationId } = await params;
  const file = getPresentationFile(presentationId);
  if (!file) return new NextResponse("Presentation not found", { status: 404 });
  return new NextResponse(Buffer.from(file), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation", "Cache-Control": "private, max-age=3600" } });
}
