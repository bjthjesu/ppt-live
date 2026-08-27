import { getPresentation } from "@/lib/presentation/store";
import { subscribeToPresentation } from "@/lib/presentation/events";

type EventsRouteProps = { params: Promise<{ presentationId: string }> };

export async function GET(request: Request, { params }: EventsRouteProps) {
  const { presentationId } = await params;
  if (!getPresentation(presentationId)) return new Response("Presentation not found", { status: 404 });

  const encoder = new TextEncoder();
  let unsubscribe = () => {};
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(": connected\n\n"));
      unsubscribe = subscribeToPresentation(presentationId, (event) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      });
      request.signal.addEventListener("abort", () => { unsubscribe(); controller.close(); });
    },
    cancel() { unsubscribe(); },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" } });
}
