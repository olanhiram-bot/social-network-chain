"use client";

import { createAppKit } from "@reown/appkit/react";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { sepolia } from "@reown/appkit/networks";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";

const projectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID;
const networks = [sepolia] as [typeof sepolia];
const queryClient = new QueryClient();

if (!projectId) {
  throw new Error("NEXT_PUBLIC_REOWN_PROJECT_ID is not configured");
}

const wagmiAdapter = new WagmiAdapter({
  projectId,
  networks,
  ssr: true,
});

createAppKit({
  adapters: [wagmiAdapter],
  networks,
  defaultNetwork: sepolia,
  projectId,
  metadata: {
    name: "Social Network",
    description: "Signer-backed social network",
    url: "http://localhost:3001",
    icons: ["http://localhost:3001/favicon.ico"],
  },
  features: {
    analytics: false,
    email: false,
    socials: [],
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
