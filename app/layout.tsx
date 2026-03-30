import type { Metadata } from "next";
import { DM_Sans, Syne } from "next/font/google";
import "./globals.css";

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
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
    images: [{ url: "/discdrop-logo-clean.svg" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "DiscDrop — Sammenlign diskgolfpriser i Norge",
    description:
      "Finn beste pris på diskgolfdisker fra norske butikker. Sammenlign priser, frakt og lagerstatus.",
    images: ["/discdrop-logo-clean.svg"],
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
      className={`${syne.variable} ${dmSans.variable} h-full antialiased`}
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
