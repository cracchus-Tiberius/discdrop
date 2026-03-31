'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';

export default function KontaktPage() {
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus('sending');

    try {
      const res = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: new FormData(e.currentTarget),
      });
      const data = await res.json();
      setStatus(data.success ? 'success' : 'error');
    } catch {
      setStatus('error');
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F5F2EB]">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b border-[#e0ddd4] bg-[#F5F2EB]/95 backdrop-blur-sm px-6 py-3">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/discdrop-logo-clean.svg" alt="DiscDrop" width={32} height={32} />
            <span className="font-bold text-[#1E3D2F] tracking-tight" style={{ fontFamily: 'var(--font-syne)' }}>
              DiscDrop
            </span>
          </Link>
          <div className="flex items-center gap-6 text-sm text-[#555]">
            <Link href="/browse" className="hover:text-[#2D6A4F] transition-colors">Disker</Link>
            <Link href="/bag/build" className="hover:text-[#2D6A4F] transition-colors">Bygg bag</Link>
          </div>
        </div>
      </nav>

      {/* Main */}
      <main className="flex-1 px-6 py-16">
        <div className="mx-auto max-w-lg">
          <h1
            className="mb-2 text-3xl font-bold text-[#1E3D2F]"
            style={{ fontFamily: 'var(--font-syne)' }}
          >
            Kontakt oss
          </h1>
          <p className="mb-10 text-[#666]">
            Spørsmål om priser, manglende disker eller noe annet? Vi hører fra deg.
          </p>

          {status === 'success' ? (
            <div className="rounded-2xl border border-[#B8E04A]/40 bg-[#B8E04A]/10 px-8 py-10 text-center">
              <div className="mb-3 text-4xl">✓</div>
              <p className="text-lg font-semibold text-[#2D6A4F]" style={{ fontFamily: 'var(--font-syne)' }}>
                Takk! Vi svarer deg snart.
              </p>
              <Link
                href="/"
                className="mt-6 inline-block text-sm text-[#2D6A4F] underline underline-offset-4 hover:opacity-75"
              >
                Tilbake til forsiden
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <input type="hidden" name="access_key" value="59b0b06c-b13d-44dd-baf5-b0081e2db0a5" />
              <input type="hidden" name="subject" value="Ny melding fra discdrop.net" />
              <input type="hidden" name="to" value="kontakt@discdrop.net" />

              <div className="space-y-1.5">
                <label htmlFor="name" className="block text-sm font-medium text-[#333]">
                  Navn
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  placeholder="Ditt navn"
                  className="w-full rounded-xl border border-[#ddd8cf] bg-white px-4 py-3 text-sm text-[#1E3D2F] placeholder:text-[#bbb] outline-none transition focus:border-[#2D6A4F] focus:ring-2 focus:ring-[#2D6A4F]/20"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="email" className="block text-sm font-medium text-[#333]">
                  E-post
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  placeholder="din@epost.no"
                  className="w-full rounded-xl border border-[#ddd8cf] bg-white px-4 py-3 text-sm text-[#1E3D2F] placeholder:text-[#bbb] outline-none transition focus:border-[#2D6A4F] focus:ring-2 focus:ring-[#2D6A4F]/20"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="message" className="block text-sm font-medium text-[#333]">
                  Melding
                </label>
                <textarea
                  id="message"
                  name="message"
                  required
                  rows={5}
                  placeholder="Hva vil du si?"
                  className="w-full rounded-xl border border-[#ddd8cf] bg-white px-4 py-3 text-sm text-[#1E3D2F] placeholder:text-[#bbb] outline-none transition focus:border-[#2D6A4F] focus:ring-2 focus:ring-[#2D6A4F]/20 resize-none"
                />
              </div>

              {status === 'error' && (
                <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  Noe gikk galt. Prøv igjen, eller send en e-post til{' '}
                  <a href="mailto:kontakt@discdrop.net" className="underline">
                    kontakt@discdrop.net
                  </a>
                  .
                </p>
              )}

              <button
                type="submit"
                disabled={status === 'sending'}
                className="w-full rounded-xl bg-[#2D6A4F] px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-[#245a41] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {status === 'sending' ? 'Sender…' : 'Send melding'}
              </button>
            </form>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#e0ddd4] bg-[#F5F2EB] px-6 py-5">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 text-[12px] text-[#999]">
          <span>© 2026 DiscDrop · Laget av <a href="https://kviist.no" target="_blank" rel="noopener noreferrer" className="text-[#2D6A4F] hover:underline">Kviist</a></span>
          <span>Prisene inkluderer 25% MVA. Fraktgrenser varierer.</span>
          <div className="flex gap-4">
            <Link href="/personvern" className="transition-colors hover:text-[#444]">Personvern</Link>
            <a href="mailto:kontakt@discdrop.net" className="transition-colors hover:text-[#444]">kontakt@discdrop.net</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
