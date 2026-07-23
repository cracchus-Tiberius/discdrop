import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "Personvern | DiscDrop",
  description:
    "Personvernerklæring for DiscDrop — hvordan vi håndterer dine personopplysninger.",
};

export default function PersonvernPage() {
  return (
    <div className="min-h-screen bg-[#FFFDF6]">
      <SiteHeader />

      <main className="mx-auto max-w-2xl px-6 py-14 sm:px-8">
        <h1 className="mb-2 text-4xl font-extrabold tracking-tight text-[#101C14]">
          Personvern&shy;erklæring
        </h1>
        <p className="mb-12 text-sm text-[#101C1477]">Sist oppdatert: Mars 2026</p>

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
                className="text-[#101C14] underline underline-offset-2 hover:opacity-80"
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
            <ul className="mt-3 space-y-1.5 pl-5 list-disc text-[#101C14CC]">
              <li>Innsyn i hvilke opplysninger vi har om deg</li>
              <li>Retting av uriktige opplysninger</li>
              <li>Sletting av opplysningene dine</li>
              <li>Tilbaketrekking av samtykke når som helst</li>
            </ul>
            <p className="mt-4">
              Ta kontakt på{" "}
              <a
                href="mailto:kontakt@discdrop.net"
                className="text-[#101C14] underline underline-offset-2 hover:opacity-80"
              >
                kontakt@discdrop.net
              </a>{" "}
              for å utøve dine rettigheter.
            </p>
          </Section>
        </div>
      </main>

      <footer className="mt-16 border-t-2 border-[#101C14] bg-[#101C14] px-5 py-6 text-[#FFFDF6] md:px-10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-3 text-[12px] text-[#FFFDF699]">
          <span>© 2026 discdrop · Laget av <a href="https://kviist.no" target="_blank" rel="noopener noreferrer" className="text-[#B8E04A] hover:underline">Kviist</a></span>
          <span>Prisene inkluderer 25% MVA. Fraktgrenser varierer.</span>
          <div className="flex gap-4">
            <Link href="/kontakt" className="transition-colors hover:text-[#FFFDF6]">Kontakt</Link>
            <a href="mailto:kontakt@discdrop.net" className="transition-colors hover:text-[#FFFDF6]">kontakt@discdrop.net</a>
          </div>
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
      <h2 className="mb-3 text-xl font-extrabold text-[#101C14]">
        {heading}
      </h2>
      <div className="text-[15px] leading-relaxed text-[#101C14CC]">{children}</div>
    </section>
  );
}
