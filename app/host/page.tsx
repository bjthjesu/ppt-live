import Link from "next/link";
import { UploadForm } from "@/components/host/UploadForm";

export default function HostUploadPage() {
  return <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-5 py-12 sm:px-10"><section className="w-full"><Link href="/" className="font-mono text-sm font-bold tracking-[0.18em] text-[#f4f1e8]">PPT LIVE</Link><div className="mt-20 max-w-xl"><p className="mb-4 text-xs uppercase tracking-[0.2em] text-[#e59f71]">Start a room</p><h1 className="text-5xl font-semibold tracking-tight text-[#f4f1e8] sm:text-7xl">Host a presentation.</h1><p className="mt-6 text-lg leading-8 text-[#a9bdc1]">Upload your PowerPoint, then share one link with everyone watching.</p><div className="mt-10"><UploadForm /></div></div></section></main>;
}
