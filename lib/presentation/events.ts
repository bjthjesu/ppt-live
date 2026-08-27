import type { SlideChangedEvent } from "./types";

type Listener = (event: SlideChangedEvent) => void;

type EventsRuntime = typeof globalThis & {
  __pptLiveListeners?: Map<string, Set<Listener>>;
};

const runtime = globalThis as EventsRuntime;
const listeners = runtime.__pptLiveListeners ?? new Map<string, Set<Listener>>();
runtime.__pptLiveListeners = listeners;

export function subscribeToPresentation(id: string, listener: Listener): () => void {
  const presentationListeners = listeners.get(id) ?? new Set<Listener>();
  presentationListeners.add(listener);
  listeners.set(id, presentationListeners);

  return () => {
    presentationListeners.delete(listener);
    if (presentationListeners.size === 0) listeners.delete(id);
  };
}

export function publishSlideChange(event: SlideChangedEvent): void {
  listeners.get(event.presentationId)?.forEach((listener) => listener(event));
}
