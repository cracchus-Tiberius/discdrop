import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Personvern | DiscDrop",
  description:
    "Personvernerklæring for DiscDrop — hvordan vi håndterer dine personopplysninger.",
};

export default function PersonvernPage() {
  return (
    <div className="min-h-screen bg-[#F5F2EB]">
      {/* Minimal navbar */}
      <nav className="flex w-full items-center justify-between bg-[#F5F2EB] px-8 py-4 border-b border-[#e0ddd4]">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 text-[#1a1a1a] transition-opacity hover:opacity-85"
        >
          <svg width="26" height="26" viewBox="0 0 44 44" fill="none" aria-hidden>
            <circle cx="22" cy="22" r="20" stroke="#2D6A4F" strokeWidth="1.5" opacity="0.4" />
            <circle cx="22" cy="22" r="13" stroke="#2D6A4F" strokeWidth="1.5" />
            <ellipse cx="22" cy="22" rx="20" ry="6" stroke="#2D6A4F" strokeWidth="1" opacity="0.5" />
            <circle cx="22" cy="22" r="3.5" fill="#2D6A4F" />
          </svg>
          <span className="text-lg font-semibold tracking-tight">DiscDrop</span>
        </Link>
        <Link
          href="/"
          className="text-sm text-[#444] transition-colors hover:text-[#1a1a1a]"
        >
          ← Tilbake til forsiden
        </Link>
      </nav>

      <main className="mx-auto max-w-2xl px-6 py-14 sm:px-8">
        <h1 className="mb-2 font-heading text-4xl font-semibold tracking-tight text-[#1E3D2F]">
          Personvern&shy;erklæring
        </h1>
        <p className="mb-12 text-sm text-[#888]">Sist oppdatert: Mars 2026</p>

        <div className="space-y-10">
          <Section heading="Hvem vi er">
            <p>
              DiscDrop er en prissammenligningstjeneste for disc golf drevet av{" "}
              <strong>Kviist Studio</strong>. Vi hjelper deg med å finne beste pris på
              discer fra norske butikker, inkludert frakt.
            </p>
            <p className="mt-3">
              Kontakt:{" "}
              <a
                href="mailto:kontakt@discdrop.net"
                className="text-[#2D6A4F] underline underline-offset-2 hover:opacity-80"
              >
                kontakt@discdrop.net
              </a>
            </p>
          </Section>

          <Section heading="Hvilke data vi samler inn">
            <p>
              Vi samler kun inn <strong>e-postadresser</strong> når du frivillig
              registrerer deg for prisvarslinger. Vi samler ikke inn personlig
              informasjon uten ditt samtykke, og vi samler ikke inn
              opplysninger om deg bare ved at du besøker nettsiden.
            </p>
          </Section>

          <Section heading="Hvordan vi bruker data">
            <p>
              E-postadresser brukes utelukkende til å sende de prisvarslene og
              nyhetsbrevene du selv har bedt om. Vi selger aldri data til
              tredjepart, og vi deler ikke opplysningene dine med andre aktører.
            </p>
          </Section>

          <Section heading="Informasjonskapsler (cookies)">
            <p>
              DiscDrop bruker <strong>Cloudflare Web Analytics</strong> for å
              se anonyme besøkstall og sidevisninger. Dette verktøyet bruker{" "}
              <strong>ingen informasjonskapsler</strong>, samler ikke inn
              personlig identifiserbar informasjon, og krever ikke samtykke.
              Dataene behandles anonymt og deles ikke videre.
            </p>
            <p className="mt-3">
              Vi bruker ingen sporings- eller reklamecookies, og vi setter ikke
              opp tredjeparts analyseverktøy som samler inn data om deg.
            </p>
          </Section>

          <Section heading="Affiliate-lenker">
            <p>
              DiscDrop bruker <strong>affiliate-lenker</strong> til norske
              butikker. Det betyr at vi kan tjene en liten provisjon når du
              kjøper via lenker på siden. Dette koster deg ingenting ekstra og
              påvirker ikke prisene du ser — prisene hentes direkte fra
              butikkene.
            </p>
          </Section>

          <Section heading="Dine rettigheter">
            <p>
              I henhold til personopplysningsloven og GDPR har du rett til:
            </p>
            <ul className="mt-3 space-y-1.5 pl-5 list-disc text-[#444]">
              <li>Innsyn i hvilke opplysninger vi har om deg</li>
              <li>Retting av uriktige opplysninger</li>
              <li>Sletting av opplysningene dine</li>
              <li>Tilbaketrekking av samtykke når som helst</li>
            </ul>
            <p className="mt-4">
              Ta kontakt på{" "}
              <a
                href="mailto:kontakt@discdrop.net"
                className="text-[#2D6A4F] underline underline-offset-2 hover:opacity-80"
              >
                kontakt@discdrop.net
              </a>{" "}
              for å utøve dine rettigheter.
            </p>
          </Section>
        </div>
      </main>

      <footer className="border-t border-[#e0ddd4] bg-[#1E3D2F] px-6 py-6">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-4 text-[13px] text-[#9DC08B]">
          <span>© 2026 DiscDrop — Kviist Studio</span>
          <a
            href="mailto:kontakt@discdrop.net"
            className="hover:text-[#F5F2EB] transition-colors"
          >
            kontakt@discdrop.net
          </a>
        </div>
      </footer>
    </div>
  );
}

function Section({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-3 font-heading text-xl font-semibold text-[#2D6A4F]">
        {heading}
      </h2>
      <div className="text-[15px] leading-relaxed text-[#333]">{children}</div>
    </section>
  );
}
