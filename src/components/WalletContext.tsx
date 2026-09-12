"use client";

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { ethers } from 'ethers';
import { useAppKit, useAppKitAccount, useAppKitNetwork, useAppKitProvider, useDisconnect } from '@reown/appkit/react';
import { ink } from '@reown/appkit/networks';

export type Network = 'Ink';

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
  connect: (network?: Network) => void;
  disconnect: () => void;
  setNetwork: (network: Network) => void;
  addTransaction: (tx: Omit<Transaction, 'id' | 'date' | 'status'>) => void;
  updateStakedBalance: (poolId: string, amount: number) => void;
  updateTokenBalance: (tokenId: string, amount: number) => void;
}

const initialTransactions: Transaction[] = [];

const WalletContext = createContext<WalletState | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }) {
  const { open } = useAppKit();
  const { address: appKitAddress, isConnected: appKitIsConnected } = useAppKitAccount();
  const { disconnect: appKitDisconnect } = useDisconnect();
  const { caipNetwork, switchNetwork } = useAppKitNetwork();
  const { walletProvider } = useAppKitProvider('eip155');

  const [localNetwork, setLocalNetwork] = useState<Network>('Ink');
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions);
  const [stakedBalances, setStakedBalances] = useState<Record<string, number>>({
    usdc: 0,
    eth: 0
  });
  const [tokenBalances, setTokenBalances] = useState<Record<string, number>>({
    ETH: 0,
  });
  const [isHydrated, setIsHydrated] = useState(false);

  // Derived state
  const isConnected = appKitIsConnected;
  
  const address = appKitAddress 
    ? `${appKitAddress.substring(0, 6)}...${appKitAddress.substring(appKitAddress.length - 4)}`
    : null;

  const getMappedNetwork = (_caipNetName?: string, _caipNetId?: string): Network => {
    return 'Ink';
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
      localStorage.setItem('wallet_local_net', localNetwork);
    }
  }, [balance, transactions, stakedBalances, tokenBalances, localNetwork, isHydrated]);

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

  const connect = async (_selectedNetwork?: Network) => {
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
    setBalance(0);
  };

  const setNetwork = async (selectedNetwork: Network) => {
    setLocalNetwork(selectedNetwork);
    if (appKitIsConnected) {
      try {
        if (switchNetwork) {
          await switchNetwork(ink as any);
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
