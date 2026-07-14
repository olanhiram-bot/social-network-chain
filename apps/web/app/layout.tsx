import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import nexoLogo from "./nexo.png";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://social-network-chain.vercel.app"),
  title: {
    default: "Nexo — Onchain social network",
    template: "%s | Nexo",
  },
  description: "Nexo is an onchain social network for posts, communities, messages, marketplace, events, and live video on Ethereum Sepolia.",
  keywords: ["onchain social network", "Ethereum Sepolia", "Web3 community", "decentralized social", "Nexo"],
  icons: { icon: nexoLogo.src },
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Nexo",
    title: "Nexo — Onchain social network",
    description: "Your social layer for posts, communities, messages, marketplace, events, and live video.",
    images: [{ url: nexoLogo.src, width: 1254, height: 1254, alt: "Nexo logo" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Nexo — Onchain social network",
    description: "Your social layer for the onchain internet.",
    images: [nexoLogo.src],
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
