import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Bygg din bag — Få personlige diskgolfanbefalinger | DiscDrop",
  description:
    "Svar på 4 spørsmål og få AI-drevne anbefalinger for din diskgolfbag. Tilpasset ditt nivå og kastestil.",
  alternates: {
    canonical: "https://discdrop.net/bag/build",
  },
  openGraph: {
    title: "Bygg din bag — Få personlige diskgolfanbefalinger | DiscDrop",
    description:
      "Svar på 4 spørsmål og få AI-drevne anbefalinger for din diskgolfbag. Tilpasset ditt nivå og kastestil.",
    url: "https://discdrop.net/bag/build",
  },
};

export default function BagBuildLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
