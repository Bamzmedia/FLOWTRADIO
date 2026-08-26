"use client";

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { ethers } from 'ethers';
import { useAppKit, useAppKitAccount, useAppKitNetwork, useAppKitProvider, useDisconnect } from '@reown/appkit/react';
import { mainnet, arbitrum, polygon } from '@reown/appkit/networks';

export type Network = 'Ethereum' | 'Arbitrum' | 'Solana' | 'Polygon';

export interface Transaction {
  id: string;
  type: 'Deposit' | 'Withdraw' | 'Transfer' | 'Trade' | 'Stake' | 'Unstake' | 'Swap';
  amount: number;
  asset: string;
  date: Date;
  status: 'Pending' | 'Completed' | 'Failed';
  network: Network | string;
  takeProfit?: number;
  stopLoss?: number;
}

interface WalletState {
  isConnected: boolean;
  address: string | null;
  network: Network;
  balance: number;
  transactions: Transaction[];
  stakedBalances: Record<string, number>;
  tokenBalances: Record<string, number>;
  connect: (network: Network, isDemo?: boolean) => void;
  disconnect: () => void;
  setNetwork: (network: Network) => void;
  addTransaction: (tx: Omit<Transaction, 'id' | 'date' | 'status'>) => void;
  updateStakedBalance: (poolId: string, amount: number) => void;
  updateTokenBalance: (tokenId: string, amount: number) => void;
}

const mockTransactions: Transaction[] = [
  { id: 'tx-1', type: 'Deposit', amount: 5000, asset: 'USDC', date: new Date(Date.now() - 86400000 * 2), status: 'Completed', network: 'Arbitrum' },
  { id: 'tx-2', type: 'Trade', amount: -1500, asset: 'USDC', date: new Date(Date.now() - 86400000 * 1), status: 'Completed', network: 'Arbitrum' },
  { id: 'tx-3', type: 'Withdraw', amount: 200, asset: 'USDT', date: new Date(Date.now() - 3600000 * 5), status: 'Completed', network: 'Ethereum' },
];

const WalletContext = createContext<WalletState | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }) {
  const { open } = useAppKit();
  const { address: appKitAddress, isConnected: appKitIsConnected } = useAppKitAccount();
  const { disconnect: appKitDisconnect } = useDisconnect();
  const { caipNetwork, switchNetwork } = useAppKitNetwork();
  const { walletProvider } = useAppKitProvider('eip155');

  const [isDemoConnected, setIsDemoConnected] = useState(false);
  const [localNetwork, setLocalNetwork] = useState<Network>('Arbitrum');
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>(mockTransactions);
  const [stakedBalances, setStakedBalances] = useState<Record<string, number>>({
    nado: 0,
    usdc: 0,
    eth: 0
  });
  const [tokenBalances, setTokenBalances] = useState<Record<string, number>>({
    NADO: 0,
    ETH: 0,
  });
  const [isHydrated, setIsHydrated] = useState(false);

  // Derived state
  const isConnected = appKitIsConnected || isDemoConnected;
  
  const address = appKitAddress 
    ? `${appKitAddress.substring(0, 6)}...${appKitAddress.substring(appKitAddress.length - 4)}`
    : (isDemoConnected ? "0x71C...392b" : null);

  const getMappedNetwork = (caipNetName?: string, caipNetId?: string): Network => {
    const searchString = `${caipNetName || ''} ${caipNetId || ''}`.toLowerCase();
    if (searchString.includes('arbitrum') || searchString.includes('42161')) return 'Arbitrum';
    if (searchString.includes('polygon') || searchString.includes('matic') || searchString.includes('137')) return 'Polygon';
    if (searchString.includes('ethereum') || searchString.includes('mainnet') || searchString.includes('eip155:1')) return 'Ethereum';
    return 'Arbitrum';
  };

  const network = appKitIsConnected && caipNetwork
    ? getMappedNetwork(caipNetwork.name, caipNetwork.id?.toString())
    : localNetwork;

  // Hydrate from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedBalance = localStorage.getItem('wallet_balance');
      if (savedBalance) setBalance(parseFloat(savedBalance));

      const savedTx = localStorage.getItem('wallet_transactions');
      if (savedTx) setTransactions(JSON.parse(savedTx));

      const savedStaked = localStorage.getItem('wallet_staked');
      if (savedStaked) setStakedBalances(JSON.parse(savedStaked));

      const savedTokens = localStorage.getItem('wallet_tokens');
      if (savedTokens) setTokenBalances(JSON.parse(savedTokens));
      
      const savedDemo = localStorage.getItem('wallet_is_demo');
      if (savedDemo) setIsDemoConnected(savedDemo === 'true');

      const savedLocalNet = localStorage.getItem('wallet_local_net');
      if (savedLocalNet) setLocalNetwork(savedLocalNet as Network);

      setIsHydrated(true);
    }
  }, []);

  // Sync to localStorage on change
  useEffect(() => {
    if (isHydrated && typeof window !== 'undefined') {
      localStorage.setItem('wallet_balance', balance.toString());
      localStorage.setItem('wallet_transactions', JSON.stringify(transactions));
      localStorage.setItem('wallet_staked', JSON.stringify(stakedBalances));
      localStorage.setItem('wallet_tokens', JSON.stringify(tokenBalances));
      localStorage.setItem('wallet_is_demo', isDemoConnected.toString());
      localStorage.setItem('wallet_local_net', localNetwork);
    }
  }, [balance, transactions, stakedBalances, tokenBalances, isDemoConnected, localNetwork, isHydrated]);

  // Sync real balance if AppKit connects
  useEffect(() => {
    const fetchBalance = async () => {
      if (appKitIsConnected && appKitAddress && walletProvider) {
        try {
          const provider = new ethers.BrowserProvider(walletProvider as any);
          const balanceWei = await provider.getBalance(appKitAddress);
          setBalance(parseFloat(ethers.formatEther(balanceWei)));
        } catch (e) {
          console.error("Failed to fetch balance", e);
        }
      }
    };
    fetchBalance();
  }, [appKitIsConnected, appKitAddress, walletProvider]);

  const connect = async (selectedNetwork: Network, isDemo: boolean = false) => {
    if (isDemo) {
      setIsDemoConnected(true);
      setLocalNetwork(selectedNetwork);
      setBalance(10000); // $10,000 USDC starting balance
      setTokenBalances({
        NADO: 500,
        ETH: 1.5
      });
      return;
    }

    try {
      await open();
    } catch (error) {
      console.error("Connection failed", error);
    }
  };

  const disconnect = () => {
    if (appKitIsConnected) {
      appKitDisconnect();
    }
    setIsDemoConnected(false);
    setBalance(0);
  };

  const setNetwork = async (selectedNetwork: Network) => {
    setLocalNetwork(selectedNetwork);
    if (appKitIsConnected) {
      let targetNetwork: any = arbitrum;
      if (selectedNetwork === 'Ethereum') targetNetwork = mainnet;
      if (selectedNetwork === 'Polygon') targetNetwork = polygon;
      
      try {
        if (switchNetwork) {
          await switchNetwork(targetNetwork);
        }
      } catch (err) {
        console.error("Failed to switch network in AppKit", err);
      }
    }
  };

  const addTransaction = (tx: Omit<Transaction, 'id' | 'date' | 'status'>) => {
    const newTx: Transaction = {
      ...tx,
      id: `tx-${Math.random().toString(36).substring(7)}`,
      date: new Date(),
      status: 'Pending',
    };
    setTransactions(prev => [newTx, ...prev]);
    
    // Simulate completion after 2 seconds
    setTimeout(() => {
      setTransactions(prev => prev.map(t => t.id === newTx.id ? { ...t, status: 'Completed' } : t));
      
      // Update balance if deposit, withdraw, trade, stake, or unstake
      if (tx.type === 'Deposit') setBalance(b => b + tx.amount);
      if (tx.type === 'Withdraw') setBalance(b => b - tx.amount);
      if (tx.type === 'Trade') setBalance(b => b + tx.amount); // negative amount for deducting cost
      if (tx.type === 'Stake') {
        if (tx.asset === 'USDC') setBalance(b => b - Math.abs(tx.amount));
        else setTokenBalances(prev => ({...prev, [tx.asset]: (prev[tx.asset] || 0) - Math.abs(tx.amount)}));
      }
      if (tx.type === 'Unstake') {
        if (tx.asset === 'USDC') setBalance(b => b + Math.abs(tx.amount));
        else setTokenBalances(prev => ({...prev, [tx.asset]: (prev[tx.asset] || 0) + Math.abs(tx.amount)}));
      }
      if (tx.type === 'Swap') setBalance(b => b - Math.abs(tx.amount)); // Deduct base USDC cost
    }, 2000);
  };

  const updateStakedBalance = (poolId: string, amount: number) => {
    setStakedBalances(prev => ({ ...prev, [poolId]: prev[poolId] + amount }));
  };

  const updateTokenBalance = (tokenId: string, amount: number) => {
    setTokenBalances(prev => ({ ...prev, [tokenId]: (prev[tokenId] || 0) + amount }));
  };

  return (
    <WalletContext.Provider value={{
      isConnected, address, network, balance, transactions, stakedBalances, tokenBalances,
      connect, disconnect, setNetwork, addTransaction, updateStakedBalance, updateTokenBalance
    }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}
