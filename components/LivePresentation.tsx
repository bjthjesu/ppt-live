"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PptViewer } from "@/components/PptViewer";
import type { Presentation, SlideChangedEvent } from "@/lib/presentation";

type LivePresentationProps = { presentation: Presentation; mode: "host" | "student" };

export function LivePresentation({ presentation, mode }: LivePresentationProps) {
  const [currentSlide, setCurrentSlide] = useState(presentation.currentSlide);
  const [slideCount, setSlideCount] = useState(presentation.slideCount);
  const [copyState, setCopyState] = useState("Copy link");
  const studentUrl = typeof window === "undefined" ? `/presentation/${presentation.id}` : `${window.location.protocol}//${window.location.hostname}:3001/presentation/${presentation.id}`;

  useEffect(() => {
    const source = new EventSource(`/api/presentations/${presentation.id}/events`);
    source.onmessage = (message) => { const event = JSON.parse(message.data) as SlideChangedEvent; if (event.type === "SLIDE_CHANGED") setCurrentSlide(event.slideNumber); };
    return () => source.close();
  }, [presentation.id]);

  useEffect(() => {
    if (mode !== "student") return;
    const syncCurrentSlide = async () => {
      const response = await fetch(`/api/presentations/${presentation.id}/slide`, { cache: "no-store" });
      if (!response.ok) return;
      const result = (await response.json()) as { presentation?: Presentation };
      if (result.presentation) { setCurrentSlide(result.presentation.currentSlide); setSlideCount(result.presentation.slideCount); }
    };
    const interval = window.setInterval(() => void syncCurrentSlide(), 1000);
    return () => window.clearInterval(interval);
  }, [mode, presentation.id]);

  async function changeSlide(nextSlide: number) {
    const response = await fetch(`/api/presentations/${presentation.id}/slide`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slideNumber: nextSlide }) });
    if (response.ok) setCurrentSlide(nextSlide);
  }

  async function recordSlideCount(count: number) {
    if (count === slideCount) return;
    setSlideCount(count);
    await fetch(`/api/presentations/${presentation.id}/slide`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slideCount: count }) });
  }

  async function copyLink() { await navigator.clipboard.writeText(studentUrl); setCopyState("Copied"); window.setTimeout(() => setCopyState("Copy link"), 1600); }

  return <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-5 py-8 sm:px-10 lg:py-12"><header className="flex items-center justify-between"><Link href="/" className="font-mono text-sm font-bold tracking-[0.18em] text-[#f4f1e8]">PPT LIVE</Link><span className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-[#9eb5bd]"><i className="h-2 w-2 rounded-full bg-[#65d391]" /> Online</span></header><section className="flex flex-col gap-5"><div className="flex items-end justify-between gap-4"><div><p className="mb-2 text-xs uppercase tracking-[0.2em] text-[#e59f71]">{mode === "host" ? "Presenter view" : "Live presentation"}</p><h1 className="max-w-2xl text-3xl font-semibold tracking-tight text-[#f4f1e8] sm:text-5xl">{presentation.fileName}</h1></div><p className="shrink-0 font-mono text-lg text-[#c6d8d3]">{currentSlide} <span className="text-[#66808a]">/</span> {presentation.slideCount}</p></div><PptViewer fileUrl={`/api/presentations/${presentation.id}/file`} slideNumber={currentSlide} onSlideCount={(count) => void recordSlideCount(count)} /></section>{mode === "host" ? <section className="flex flex-col gap-5 border-t border-[#31464e] pt-6 sm:flex-row sm:items-center sm:justify-between"><div className="flex gap-3"><button onClick={() => void changeSlide(currentSlide - 1)} disabled={currentSlide <= 1} className="rounded-full border border-[#607880] px-5 py-3 text-sm font-medium text-[#e6eee8] transition hover:bg-[#20343d] disabled:cursor-not-allowed disabled:opacity-35">Previous</button><button onClick={() => void changeSlide(currentSlide + 1)} disabled={currentSlide >= slideCount} className="rounded-full bg-[#e59f71] px-6 py-3 text-sm font-bold text-[#17252c] transition hover:bg-[#f2b487] disabled:cursor-not-allowed disabled:opacity-35">Next</button></div><div className="flex min-w-0 items-center gap-3"><div className="min-w-0"><p className="text-xs uppercase tracking-[0.16em] text-[#849ba2]">Student link</p><p className="truncate font-mono text-sm text-[#c6d8d3]">{studentUrl}</p></div><button onClick={() => void copyLink()} className="shrink-0 rounded-full border border-[#607880] px-4 py-2 text-xs font-bold text-[#f4f1e8] transition hover:bg-[#20343d]">{copyState}</button></div></section> : <p className="text-center text-xs uppercase tracking-[0.18em] text-[#9eb5bd]">● Connected · Follow along live</p>}</main>;
}