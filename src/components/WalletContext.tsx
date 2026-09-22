"use client";

import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { useAppKit, useAppKitAccount, useAppKitNetwork, useAppKitProvider, useDisconnect } from '@reown/appkit/react';
import { ink } from '@reown/appkit/networks';

export type Network = 'Ink';

export const INK_CHAIN_ID = 57073;
export const INK_CHAIN_ID_HEX = '0xdef1';
export const INK_NETWORK_PARAMS = {
  chainId: INK_CHAIN_ID_HEX,
  chainName: 'Ink',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: ['https://rpc-gel.inkonchain.com', 'https://rpc-qnd.inkonchain.com'],
  blockExplorerUrls: ['https://explorer.inkonchain.com'],
};

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

export interface WalletState {
  isConnected: boolean;
  address: string | null; // Full 42-character checksummed EVM address
  displayAddress: string | null; // Shortened format (e.g. 0x1234...5678)
  network: Network;
  chainId: number | null;
  isWrongNetwork: boolean;
  balance: number;
  isBalanceLoading: boolean;
  balanceError: string | null;
  transactions: Transaction[];
  stakedBalances: Record<string, number>;
  tokenBalances: Record<string, number>;
  connect: (preferredProvider?: string) => Promise<void>;
  disconnect: () => void;
  setNetwork: (network: Network) => void;
  switchToInk: () => Promise<boolean>;
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
  const { walletProvider: appKitProvider } = useAppKitProvider('eip155');

  // Injected fallback state (MetaMask / EIP-1193 browser extension)
  const [injectedAddress, setInjectedAddress] = useState<string | null>(null);
  const [injectedConnected, setInjectedConnected] = useState(false);
  const [injectedChainId, setInjectedChainId] = useState<number | null>(null);

  const [localNetwork, setLocalNetwork] = useState<Network>('Ink');
  const [balance, setBalance] = useState(0);
  const [isBalanceLoading, setIsBalanceLoading] = useState(true);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions);
  const [stakedBalances, setStakedBalances] = useState<Record<string, number>>({
    usdc: 0,
    eth: 0,
  });
  const [tokenBalances, setTokenBalances] = useState<Record<string, number>>({
    ETH: 0,
  });
  const [isHydrated, setIsHydrated] = useState(false);

  // Normalization: raw address candidate
  const rawAddress = appKitAddress || injectedAddress || null;
  
  // Normalized 42-char checksummed address
  let normalizedAddress: string | null = null;
  if (rawAddress) {
    try {
      normalizedAddress = ethers.getAddress(rawAddress);
    } catch {
      normalizedAddress = rawAddress;
    }
  }

  const isConnected = Boolean(appKitIsConnected || injectedConnected) && Boolean(normalizedAddress);

  const displayAddress = normalizedAddress
    ? `${normalizedAddress.substring(0, 6)}...${normalizedAddress.substring(normalizedAddress.length - 4)}`
    : null;

  // Detect Current Connected Chain ID
  let currentChainId: number | null = null;
  if (appKitIsConnected && caipNetwork?.id) {
    const parsed = Number(caipNetwork.id.toString().replace('eip155:', ''));
    if (!isNaN(parsed)) currentChainId = parsed;
  } else if (injectedChainId !== null) {
    currentChainId = injectedChainId;
  }

  // Chain Validation: Is user connected to something other than Ink (57073)?
  const isWrongNetwork = isConnected && currentChainId !== null && currentChainId !== INK_CHAIN_ID;

  const network: Network = 'Ink';

  // 1. Hydrate from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedBalance = localStorage.getItem('wallet_balance');
      if (savedBalance) setBalance(parseFloat(savedBalance));

      const savedTx = localStorage.getItem('wallet_transactions');
      if (savedTx) {
        try {
          setTransactions(JSON.parse(savedTx));
        } catch {}
      }

      const savedStaked = localStorage.getItem('wallet_staked');
      if (savedStaked) {
        try {
          setStakedBalances(JSON.parse(savedStaked));
        } catch {}
      }

      const savedTokens = localStorage.getItem('wallet_tokens');
      if (savedTokens) {
        try {
          setTokenBalances(JSON.parse(savedTokens));
        } catch {}
      }

      const savedLocalNet = localStorage.getItem('wallet_local_net');
      if (savedLocalNet) setLocalNetwork(savedLocalNet as Network);

      setIsHydrated(true);
    }
  }, []);

  // 2. Hydrate injected wallet connection if previously connected without prompt
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const eth = (window as any).ethereum;
    if (!eth) return;

    const restoreInjected = async () => {
      try {
        const savedProvider = localStorage.getItem('wallet_connected_provider');
        // Silent check for pre-authorized accounts (eth_accounts does not trigger popup)
        const accounts: string[] = await eth.request({ method: 'eth_accounts' });
        const chainIdHex: string = await eth.request({ method: 'eth_chainId' });
        
        if (chainIdHex) {
          setInjectedChainId(parseInt(chainIdHex, 16));
        }

        if (accounts && accounts.length > 0) {
          setInjectedAddress(accounts[0]);
          setInjectedConnected(true);
          if (!savedProvider) {
            localStorage.setItem('wallet_connected_provider', 'injected');
          }
        }
      } catch (err) {
        console.debug('[WalletContext] Silent injected check skipped:', err);
      }
    };

    restoreInjected();

    // Event listeners for external wallet changes
    const handleAccountsChanged = (accounts: string[]) => {
      if (!accounts || accounts.length === 0) {
        setInjectedAddress(null);
        setInjectedConnected(false);
        localStorage.removeItem('wallet_connected_provider');
      } else {
        setInjectedAddress(accounts[0]);
        setInjectedConnected(true);
      }
    };

    const handleChainChanged = (chainIdHex: string) => {
      setInjectedChainId(parseInt(chainIdHex, 16));
    };

    eth.on?.('accountsChanged', handleAccountsChanged);
    eth.on?.('chainChanged', handleChainChanged);

    return () => {
      eth.removeListener?.('accountsChanged', handleAccountsChanged);
      eth.removeListener?.('chainChanged', handleChainChanged);
    };
  }, []);

  // 3. Sync to localStorage on change
  useEffect(() => {
    if (isHydrated && typeof window !== 'undefined') {
      localStorage.setItem('wallet_balance', balance.toString());
      localStorage.setItem('wallet_transactions', JSON.stringify(transactions));
      localStorage.setItem('wallet_staked', JSON.stringify(stakedBalances));
      localStorage.setItem('wallet_tokens', JSON.stringify(tokenBalances));
      localStorage.setItem('wallet_local_net', localNetwork);
    }
  }, [balance, transactions, stakedBalances, tokenBalances, localNetwork, isHydrated]);

  // 4. Fetch native balance on Ink
  const fetchBalance = useCallback(async () => {
    if (!isConnected || !normalizedAddress) {
      setIsBalanceLoading(false);
      return;
    }

    try {
      setIsBalanceLoading(true);
      setBalanceError(null);
      
      const activeProviderSource = appKitProvider || (typeof window !== 'undefined' ? (window as any).ethereum : null);
      if (activeProviderSource) {
        const provider = new ethers.BrowserProvider(activeProviderSource as any);
        const balanceWei = await provider.getBalance(normalizedAddress);
        setBalance(parseFloat(ethers.formatEther(balanceWei)));
        return;
      }
      
      // Fallback: query Ink public RPC directly
      const rpcProvider = new ethers.JsonRpcProvider('https://rpc-gel.inkonchain.com');
      const balanceWei = await rpcProvider.getBalance(normalizedAddress);
      setBalance(parseFloat(ethers.formatEther(balanceWei)));
    } catch (e) {
      console.warn('[WalletContext] Failed to fetch live wallet balance:', e);
      setBalanceError('Unable to load balance');
    } finally {
      setIsBalanceLoading(false);
    }
  }, [isConnected, normalizedAddress, appKitProvider]);

  useEffect(() => {
    fetchBalance();
    const timer = setInterval(fetchBalance, 15000);
    return () => clearInterval(timer);
  }, [fetchBalance]);

  // 5. Connect handler
  const connect = async (preferredProvider?: string) => {
    const eth = typeof window !== 'undefined' ? (window as any).ethereum : null;

    // A. Direct injected provider requested (e.g. MetaMask clicked)
    if ((preferredProvider === 'metamask' || preferredProvider === 'injected') && eth) {
      try {
        const accounts: string[] = await eth.request({ method: 'eth_requestAccounts' });
        const chainIdHex: string = await eth.request({ method: 'eth_chainId' });
        
        if (chainIdHex) {
          setInjectedChainId(parseInt(chainIdHex, 16));
        }
        if (accounts && accounts.length > 0) {
          setInjectedAddress(accounts[0]);
          setInjectedConnected(true);
          localStorage.setItem('wallet_connected_provider', 'injected');
          return;
        }
      } catch (injectedErr: any) {
        console.warn('[WalletContext] Injected eth_requestAccounts declined/failed, opening modal:', injectedErr);
        if (injectedErr?.code === 4001) return; // User rejected
      }
    }

    // B. AppKit Modal trigger
    try {
      await open();
    } catch (error) {
      console.warn('[WalletContext] AppKit open modal error. Trying fallback injected request:', error);
      if (eth) {
        try {
          const accounts: string[] = await eth.request({ method: 'eth_requestAccounts' });
          if (accounts && accounts.length > 0) {
            setInjectedAddress(accounts[0]);
            setInjectedConnected(true);
            localStorage.setItem('wallet_connected_provider', 'injected');
          }
        } catch (fErr) {
          console.error('[WalletContext] Injected fallback failed:', fErr);
        }
      }
    }
  };

  // 6. Disconnect handler
  const disconnect = () => {
    if (appKitIsConnected) {
      try {
        appKitDisconnect();
      } catch {}
    }
    
    setInjectedAddress(null);
    setInjectedConnected(false);
    
    if (typeof window !== 'undefined') {
      localStorage.removeItem('wallet_connected_provider');
      if (normalizedAddress) {
        sessionStorage.removeItem(`nado_auth_sig_${normalizedAddress.toLowerCase()}`);
        sessionStorage.removeItem(`nado_auth_exp_${normalizedAddress.toLowerCase()}`);
      }
    }
    
    setBalance(0);
  };

  // 7. Network Switcher to Ink (57073 / 0xdef1)
  const switchToInk = async (): Promise<boolean> => {
    // 1. Try AppKit switchNetwork
    if (appKitIsConnected && switchNetwork) {
      try {
        await switchNetwork(ink as any);
        return true;
      } catch (appKitErr) {
        console.warn('[WalletContext] AppKit switchNetwork failed, trying EIP-1193:', appKitErr);
      }
    }

    // 2. Try window.ethereum EIP-3326 wallet_switchEthereumChain
    const eth = typeof window !== 'undefined' ? (window as any).ethereum : null;
    if (eth) {
      try {
        await eth.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: INK_CHAIN_ID_HEX }],
        });
        setInjectedChainId(INK_CHAIN_ID);
        return true;
      } catch (switchError: any) {
        // 4902: Chain has not been added to MetaMask yet
        if (switchError.code === 4902 || switchError?.data?.originalError?.code === 4902) {
          try {
            await eth.request({
              method: 'wallet_addEthereumChain',
              params: [INK_NETWORK_PARAMS],
            });
            setInjectedChainId(INK_CHAIN_ID);
            return true;
          } catch (addError) {
            console.error('[WalletContext] Failed to add Ink chain to wallet:', addError);
          }
        } else {
          console.error('[WalletContext] Failed to switch to Ink chain:', switchError);
        }
      }
    }

    return false;
  };

  const setNetwork = async (_selectedNetwork: Network) => {
    setLocalNetwork('Ink');
    await switchToInk();
  };

  const addTransaction = (tx: Omit<Transaction, 'id' | 'date' | 'status'>) => {
    const newTx: Transaction = {
      ...tx,
      id: `tx-${Math.random().toString(36).substring(7)}`,
      date: new Date(),
      status: 'Pending',
    };
    setTransactions((prev) => [newTx, ...prev]);

    setTimeout(() => {
      setTransactions((prev) => prev.map((t) => (t.id === newTx.id ? { ...t, status: 'Completed' } : t)));

      if (tx.type === 'Deposit') setBalance((b) => b + tx.amount);
      if (tx.type === 'Withdraw') setBalance((b) => Math.max(0, b - tx.amount));
      if (tx.type === 'Trade') setBalance((b) => b + tx.amount);
      if (tx.type === 'Stake') {
        if (tx.asset === 'USDC') setBalance((b) => Math.max(0, b - Math.abs(tx.amount)));
        else setTokenBalances((prev) => ({ ...prev, [tx.asset]: (prev[tx.asset] || 0) - Math.abs(tx.amount) }));
      }
      if (tx.type === 'Unstake') {
        if (tx.asset === 'USDC') setBalance((b) => b + Math.abs(tx.amount));
        else setTokenBalances((prev) => ({ ...prev, [tx.asset]: (prev[tx.asset] || 0) + Math.abs(tx.amount) }));
      }
      if (tx.type === 'Swap') setBalance((b) => Math.max(0, b - Math.abs(tx.amount)));
    }, 2000);
  };

  const updateStakedBalance = (poolId: string, amount: number) => {
    setStakedBalances((prev) => ({ ...prev, [poolId]: (prev[poolId] || 0) + amount }));
  };

  const updateTokenBalance = (tokenId: string, amount: number) => {
    setTokenBalances((prev) => ({ ...prev, [tokenId]: (prev[tokenId] || 0) + amount }));
  };

  return (
    <WalletContext.Provider
      value={{
        isConnected,
        address: normalizedAddress,
        displayAddress,
        network,
        chainId: currentChainId,
        isWrongNetwork,
        balance,
        isBalanceLoading,
        balanceError,
        transactions,
        stakedBalances,
        tokenBalances,
        connect,
        disconnect,
        setNetwork,
        switchToInk,
        addTransaction,
        updateStakedBalance,
        updateTokenBalance,
      }}
    >
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
