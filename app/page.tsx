import type { Metadata } from "next";
import { DiscDropHome } from "./disc-drop-home";

export const metadata: Metadata = {
  title: "DiscDrop — Disc golf prissammenligning for Norge",
  description:
    "Sammenlign priser på discer fra norske og internasjonale butikker. Inkludert frakt og MVA.",
};

export default function Home() {
  return <DiscDropHome />;
}
