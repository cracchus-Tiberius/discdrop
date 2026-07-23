'use client';

import { useState } from 'react';
import Link from 'next/link';
import { SiteHeader } from '@/components/SiteHeader';

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
    <div className="min-h-screen flex flex-col bg-[#FFFDF6]">
      <SiteHeader />

      {/* Main */}
      <main className="flex-1 px-6 py-16">
        <div className="mx-auto max-w-lg">
          <h1 className="mb-2 text-3xl font-extrabold text-[#101C14]">
            Kontakt oss
          </h1>
          <p className="mb-10 text-[#101C1499]">
            Spørsmål om priser, manglende disker eller noe annet? Vi hører fra deg.
          </p>

          {status === 'success' ? (
            <div className="rounded-2xl border-2 border-[#101C14] bg-[#EEF7D4] px-8 py-10 text-center shadow-[4px_4px_0_#B8E04A]">
              <div className="mb-3 text-4xl">✓</div>
              <p className="text-lg font-extrabold text-[#101C14]">
                Takk! Vi svarer deg snart.
              </p>
              <Link
                href="/"
                className="mt-6 inline-block text-sm font-semibold text-[#101C14] underline underline-offset-4 hover:opacity-75"
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
                <label htmlFor="name" className="block text-sm font-semibold text-[#101C14]">
                  Navn
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  placeholder="Ditt navn"
                  className="w-full rounded-xl border-2 border-[#101C14] bg-white px-4 py-3 text-sm text-[#101C14] placeholder:text-[#101C1477] outline-none transition focus:shadow-[2px_2px_0_#B8E04A]"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="email" className="block text-sm font-semibold text-[#101C14]">
                  E-post
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  placeholder="din@epost.no"
                  className="w-full rounded-xl border-2 border-[#101C14] bg-white px-4 py-3 text-sm text-[#101C14] placeholder:text-[#101C1477] outline-none transition focus:shadow-[2px_2px_0_#B8E04A]"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="message" className="block text-sm font-semibold text-[#101C14]">
                  Melding
                </label>
                <textarea
                  id="message"
                  name="message"
                  required
                  rows={5}
                  placeholder="Hva vil du si?"
                  className="w-full rounded-xl border-2 border-[#101C14] bg-white px-4 py-3 text-sm text-[#101C14] placeholder:text-[#101C1477] outline-none transition focus:shadow-[2px_2px_0_#B8E04A] resize-none"
                />
              </div>

              {status === 'error' && (
                <p className="rounded-xl border-2 border-[#E8704A] bg-[#E8704A]/10 px-4 py-3 text-sm text-[#E8704A]">
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
                className="dd-cta w-full px-6 py-3.5 text-sm disabled:cursor-not-allowed disabled:opacity-60"
              >
                {status === 'sending' ? 'Sender…' : 'Send melding'}
              </button>
            </form>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t-2 border-[#101C14] bg-[#101C14] px-5 py-6 text-[#FFFDF6] md:px-10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-3 text-[12px] text-[#FFFDF699]">
          <span>© 2026 discdrop · Laget av <a href="https://kviist.no" target="_blank" rel="noopener noreferrer" className="text-[#B8E04A] hover:underline">Kviist</a></span>
          <span>Prisene inkluderer 25% MVA. Fraktgrenser varierer.</span>
          <div className="flex gap-4">
            <Link href="/personvern" className="transition-colors hover:text-[#FFFDF6]">Personvern</Link>
            <a href="mailto:kontakt@discdrop.net" className="transition-colors hover:text-[#FFFDF6]">kontakt@discdrop.net</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
