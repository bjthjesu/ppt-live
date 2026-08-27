import Link from "next/link";

export default function NotFound() {
  return <main className="grid min-h-screen place-items-center px-6 text-center"><div><p className="font-mono text-sm tracking-[0.18em] text-[#e59f71]">PPT LIVE</p><h1 className="mt-5 text-4xl font-semibold text-[#f4f1e8]">Presentation not found</h1><p className="mt-4 text-[#a9bdc1]">The presentation may have ended or the link may be invalid.</p><Link href="/host" className="mt-8 inline-block rounded-full bg-[#e59f71] px-6 py-3 font-bold text-[#17252c]">Host a presentation</Link></div></main>;
}
