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
  title: "DiscDrop — Find your flight. Skip the legwork.",
  description:
    "Compare disc golf prices across Norwegian stores. See real landed cost including shipping and 25% MVA before you buy.",
  keywords: [
    "disc golf",
    "discer",
    "discgolf norge",
    "kjøp discer",
    "discgolf pris",
    "sammenlign discer",
  ],
  icons: { icon: "/logo.svg" },
  metadataBase: new URL("https://discdrop.net"),
  alternates: {
    canonical: "https://discdrop.net",
  },
  openGraph: {
    title: "DiscDrop — Disc golf prissammenligning for Norge",
    description:
      "Se hvilke butikker som har disken du vil ha, til hvilken pris — inkludert frakt og MVA.",
    url: "https://discdrop.net",
    type: "website",
    images: [{ url: "/og-image.png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "DiscDrop — Disc golf prissammenligning for Norge",
    description:
      "Se hvilke butikker som har disken du vil ha, til hvilken pris — inkludert frakt og MVA.",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
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
