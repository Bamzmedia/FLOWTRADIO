"use client";

import { createAppKit } from '@reown/appkit/react';
import { EthersAdapter } from '@reown/appkit-adapter-ethers';
import { ink, inkSepolia, mainnet, arbitrum, polygon } from '@reown/appkit/networks';
import { ReactNode } from 'react';

// Get projectId from environment variables
const projectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID || '85c6dfbf513364f7b6b15801c40212f4'; // Fallback project ID for initial testing

const networks: [any, ...any[]] = [ink, inkSepolia, arbitrum, mainnet, polygon];

// Create AppKit instance
createAppKit({
  adapters: [new EthersAdapter()],
  networks,
  defaultNetwork: ink,
  projectId,
  features: {
    analytics: true
  },
  themeMode: 'dark',
  themeVariables: {
    '--w3m-accent': '#00f0ff',
    '--w3m-color-mix': '#050b14',
    '--w3m-color-mix-strength': 40
  }
});

export function AppKitProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
