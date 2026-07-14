import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import nexoLogo from "./nexo.png";

export const metadata: Metadata = {
  title: "Nexo — Onchain social network",
  description: "A social workspace for identity, communities, and live conversation.",
  icons: { icon: nexoLogo.src },
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
