import type { Metadata } from "next";
import { Bricolage_Grotesque } from "next/font/google";
import "./globals.css";
import { BRAND_OG_IMAGE, OG_TYPE_WEBSITE } from "@/lib/seo";

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "DiscDrop — Sammenlign diskgolfpriser i Norge",
  description:
    "Finn beste pris på diskgolfdisker fra norske butikker. Sammenlign priser, frakt og lagerstatus. Oppdatert daglig.",
  keywords: [
    "diskgolf",
    "diskgolf norge",
    "kjøp diskgolfdisker",
    "diskgolf pris",
    "sammenlign diskgolfpriser",
    "disc golf",
  ],
  // No manual `icons` entry here — app/favicon.ico, app/icon.svg, and
  // app/apple-icon.png (Next's file-convention icons) already generate the
  // correct <link> tags automatically; adding one here would just produce
  // a duplicate/conflicting tag alongside them.
  manifest: "/site.webmanifest",
  metadataBase: new URL("https://discdrop.net"),
  alternates: {
    canonical: "https://discdrop.net",
    languages: {
      "nb": "https://discdrop.net",
    },
  },
  openGraph: {
    title: "DiscDrop — Sammenlign diskgolfpriser i Norge",
    description:
      "Finn beste pris på diskgolfdisker fra norske butikker. Sammenlign priser, frakt og lagerstatus.",
    url: "https://discdrop.net",
    type: OG_TYPE_WEBSITE,
    images: [BRAND_OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "DiscDrop — Sammenlign diskgolfpriser i Norge",
    description:
      "Finn beste pris på diskgolfdisker fra norske butikker. Sammenlign priser, frakt og lagerstatus.",
    images: [BRAND_OG_IMAGE.url],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="nb"
      className={`${bricolage.variable} h-full antialiased`}
    >
      <body
        className="min-h-full flex flex-col bg-background text-foreground"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
