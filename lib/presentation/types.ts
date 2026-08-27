export type Presentation = {
  id: string;
  fileName: string;
  currentSlide: number;
  slideCount: number;
};

export type StoredPresentation = Presentation & {
  fileData: Uint8Array;
};

export type SlideChangedEvent = {
  type: "SLIDE_CHANGED";
  presentationId: string;
  slideNumber: number;
};
