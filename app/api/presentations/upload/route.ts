import { NextResponse } from "next/server";
import { createPresentation } from "@/lib/presentation";

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".pptx")) {
    return NextResponse.json({ error: "Please upload a valid .pptx file." }, { status: 400 });
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const presentation = createPresentation(file.name, bytes, 1);
  return NextResponse.json({ id: presentation.id });
}
