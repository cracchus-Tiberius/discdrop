import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Bygg din disc golf bag — AI bag builder | DiscDrop",
  description:
    "Få personlige disc-anbefalinger basert på ferdighetsnivå, armhastighet og spillestil.",
};

export default function BagBuildLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
