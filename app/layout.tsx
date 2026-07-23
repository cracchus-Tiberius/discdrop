import type { Metadata } from "next";
import { Bricolage_Grotesque } from "next/font/google";
import "./globals.css";

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
  icons: { icon: "/logo.svg" },
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
    type: "website",
    images: [{ url: "https://discdrop.net/og.png", width: 1200, height: 630, alt: "DiscDrop — Sammenlign diskgolfpriser i Norge" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "DiscDrop — Sammenlign diskgolfpriser i Norge",
    description:
      "Finn beste pris på diskgolfdisker fra norske butikker. Sammenlign priser, frakt og lagerstatus.",
    images: ["https://discdrop.net/og.png"],
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
