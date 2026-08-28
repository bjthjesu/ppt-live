import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export type Presentation = {
  id: string;
  fileName: string;
  currentSlide: number;
  slideCount: number;
};

type StoredPresentation = Presentation & { fileData: Uint8Array };

export type SlideChangedEvent = {
  type: "SLIDE_CHANGED";
  presentationId: string;
  slideNumber: number;
};

type Listener = (event: SlideChangedEvent) => void;

const dataDirectory = path.join(process.cwd(), ".data", "presentations");
const listeners = new Map<string, Set<Listener>>();

function presentationPath(id: string): string {
  return path.join(dataDirectory, `${id}.json`);
}

function filePath(id: string): string {
  return path.join(dataDirectory, `${id}.pptx`);
}

function readPresentation(id: string): StoredPresentation | undefined {
  try {
    const presentation = JSON.parse(readFileSync(presentationPath(id), "utf8")) as Presentation;
    return { ...presentation, fileData: new Uint8Array(readFileSync(filePath(id))) };
  } catch {
    return undefined;
  }
}

function toPublicPresentation(presentation: StoredPresentation): Presentation {
  const { fileData: _fileData, ...publicPresentation } = presentation;
  return publicPresentation;
}

function writePresentation(presentation: StoredPresentation): void {
  mkdirSync(dataDirectory, { recursive: true });
  writeFileSync(presentationPath(presentation.id), JSON.stringify(toPublicPresentation(presentation)));
  writeFileSync(filePath(presentation.id), presentation.fileData);
}

export function createPresentation(fileName: string, fileData: Uint8Array, slideCount: number): Presentation {
  const presentation: StoredPresentation = {
    id: crypto.randomUUID().replaceAll("-", "").slice(0, 8),
    fileName,
    currentSlide: 1,
    slideCount,
    fileData,
  };
  writePresentation(presentation);
  return toPublicPresentation(presentation);
}

export function getPresentation(id: string): Presentation | undefined {
  const presentation = readPresentation(id);
  return presentation ? toPublicPresentation(presentation) : undefined;
}

export function getPresentationFile(id: string): Uint8Array | undefined {
  return readPresentation(id)?.fileData;
}

export function updateCurrentSlide(id: string, currentSlide: number): Presentation | undefined {
  const presentation = readPresentation(id);
  if (!presentation) return undefined;
  presentation.currentSlide = Math.min(Math.max(currentSlide, 1), presentation.slideCount);
  writePresentation(presentation);
  return toPublicPresentation(presentation);
}

export function updateSlideCount(id: string, slideCount: number): Presentation | undefined {
  const presentation = readPresentation(id);
  if (!presentation) return undefined;
  presentation.slideCount = Math.max(1, slideCount);
  presentation.currentSlide = Math.min(presentation.currentSlide, presentation.slideCount);
  writePresentation(presentation);
  return toPublicPresentation(presentation);
}

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