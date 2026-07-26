import Link from "next/link";

export function SiteFooter({
  className = "",
  hideLink,
}: {
  className?: string;
  /** Omit the link to the page the footer is currently rendered on. */
  hideLink?: "personvern" | "kontakt" | "butikker";
}) {
  return (
    <footer className={`border-t-2 border-[#101C14] bg-[#101C14] px-5 py-6 text-[#FFFDF6] md:px-10 ${className}`}>
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-3 text-[12px] text-[#FFFDF699]">
        <span>
          © 2026 discdrop · Laget av{" "}
          <a href="https://kviist.no" target="_blank" rel="noopener noreferrer" className="text-[#B8E04A] hover:underline">
            Kviist
          </a>
        </span>
        <span>Prisene inkluderer 25% MVA. Fraktgrenser varierer.</span>
        <div className="flex gap-4">
          {hideLink !== "butikker" && (
            <Link href="/butikker" className="transition-colors hover:text-[#FFFDF6]">Butikker</Link>
          )}
          {hideLink !== "personvern" && (
            <Link href="/personvern" className="transition-colors hover:text-[#FFFDF6]">Personvern</Link>
          )}
          {hideLink !== "kontakt" && (
            <Link href="/kontakt" className="transition-colors hover:text-[#FFFDF6]">Kontakt</Link>
          )}
          <a href="mailto:kontakt@discdrop.net" className="transition-colors hover:text-[#FFFDF6]">kontakt@discdrop.net</a>
        </div>
      </div>
    </footer>
  );
}
