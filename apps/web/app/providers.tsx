"use client";

import { createAppKit } from "@reown/appkit/react";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { arbitrumSepolia, sepolia } from "@reown/appkit/networks";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { createStorage, WagmiProvider } from "wagmi";

const projectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID;
const appUrl =
  process.env.NEXT_PUBLIC_APP_URL ??
  (typeof window === "undefined" ? "https://social-network-chain-danielolan1s-projects.vercel.app" : window.location.origin);
// Keep Sepolia first as the app default. Arbitrum Sepolia only lets mobile
// wallets finish connecting when they restore that chain before switching.
const networks = [sepolia, arbitrumSepolia] as [typeof sepolia, typeof arbitrumSepolia];
const queryClient = new QueryClient();

if (!projectId) {
  throw new Error("NEXT_PUBLIC_REOWN_PROJECT_ID is not configured");
}

const wagmiAdapter = new WagmiAdapter({
  projectId,
  networks,
  ssr: true,
  storage: createStorage({ key: "nexo-wagmi-sepolia-v2" }),
  // AppKit already exposes Sepolia as the only supported network. Keeping the
  // connector's chain untouched prevents mobile wallets from racing Wagmi
  // while their connection is still being restored.
  syncConnectedChain: false,
});

export const appKit = createAppKit({
  adapters: [wagmiAdapter],
  networks,
  defaultNetwork: sepolia,
  projectId,
  metadata: {
    name: "Social Network",
    description: "Signer-backed social network",
    url: appUrl,
    icons: [`${appUrl}/favicon.ico`],
  },
  features: {
    analytics: false,
    email: false,
    socials: [],
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    function suppressExternalFetchOverlay(event: PromiseRejectionEvent) {
      if (event.reason instanceof TypeError && event.reason.message === "Failed to fetch") {
        event.preventDefault();
      }
    }

    window.addEventListener("unhandledrejection", suppressExternalFetchOverlay);
    return () => window.removeEventListener("unhandledrejection", suppressExternalFetchOverlay);
  }, []);

  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
