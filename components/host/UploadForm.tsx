"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function UploadForm() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState(false);

  function chooseFile(selected: File | undefined) {
    setError("");
    if (!selected) return;
    if (!selected.name.toLowerCase().endsWith(".pptx") || selected.type && selected.type !== "application/vnd.openxmlformats-officedocument.presentationml.presentation") {
      setFile(null);
      setError("Please upload a valid .pptx file.");
      return;
    }
    setFile(selected);
  }

  async function startPresentation() {
    if (!file) { setError("Choose a .pptx file before starting."); return; }
    setProcessing(true);
    setError("");
    const body = new FormData();
    body.append("file", file);
    try {
      const response = await fetch("/api/presentations/upload", { method: "POST", body });
      const result = (await response.json()) as { id?: string; error?: string };
      if (!response.ok || !result.id) throw new Error(result.error ?? "Upload failed.");
      router.push(`/host/${result.id}`);
    } catch (uploadError) {
      setProcessing(false);
      setError(uploadError instanceof Error ? uploadError.message : "Upload failed.");
    }
  }

  return <div className="flex flex-col gap-5"><label className="grid min-h-36 cursor-pointer place-items-center rounded-[1.25rem] border border-dashed border-[#607880] bg-[#1b3039] px-6 text-center transition hover:border-[#e59f71] hover:bg-[#203740]"><input type="file" accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation" className="sr-only" onChange={(event) => chooseFile(event.target.files?.[0])} /><span><strong className="block text-lg text-[#f4f1e8]">{file ? file.name : "Choose a PPTX file"}</strong><span className="mt-2 block text-sm text-[#9eb5bd]">PowerPoint files only</span></span></label>{error && <p className="text-sm text-[#ffb4a8]">{error}</p>}<button onClick={() => void startPresentation()} disabled={processing} className="rounded-full bg-[#e59f71] px-6 py-3 font-bold text-[#17252c] transition hover:bg-[#f2b487] disabled:cursor-wait disabled:opacity-60">{processing ? "Preparing presentation..." : "Start presentation"}</button></div>;
}
