"use client";

import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { useAppKit, useAppKitAccount, useAppKitNetwork, useAppKitProvider, useDisconnect } from '@reown/appkit/react';
import { ink } from '@reown/appkit/networks';
import { getSubaccountHex, fetchNadoSubaccountInfo, parseSubaccountBalances, fetchUserNadoPortfolio } from '../nado/nadoApi';
import { NadoSpotAsset, NadoPerpPosition } from '../types/nado';

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
  balance: number; // Primary Nado DEX balance
  nadoBalance: number; // Live free trading margin on Nado DEX
  nadoCollateral: number; // Total account collateral / equity on Nado
  nadoFreeCollateral: number; // Available/free collateral on Nado
  nadoMarginUsage: number; // Locked margin in active positions on Nado
  nadoSpotAssets: NadoSpotAsset[]; // Spot tokens deposited into Nado DEX
  nadoPositions: NadoPerpPosition[]; // Open perpetual contracts on Nado
  subaccountNames: string[]; // User subaccount names found on Nado
  activeSubaccount: string; // Currently active subaccount hex
  setActiveSubaccount: (subaccountHex: string) => void;
  walletUsdcBalance: number; // On-chain USDC in MetaMask wallet
  ethBalance: number; // Native ETH for gas on Ink
  isBalanceLoading: boolean;
  balanceError: string | null;
  transactions: Transaction[];
  stakedBalances: Record<string, number>;
  tokenBalances: Record<string, number>;
  connect: (preferredProvider?: string) => Promise<void>;
  disconnect: () => void;
  setNetwork: (network: Network) => void;
  switchToInk: () => Promise<boolean>;
  refetchBalance: () => Promise<void>;
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
  const [nadoBalance, setNadoBalance] = useState(0);
  const [nadoCollateral, setNadoCollateral] = useState(0);
  const [nadoFreeCollateral, setNadoFreeCollateral] = useState(0);
  const [nadoMarginUsage, setNadoMarginUsage] = useState(0);
  const [nadoSpotAssets, setNadoSpotAssets] = useState<NadoSpotAsset[]>([]);
  const [nadoPositions, setNadoPositions] = useState<NadoPerpPosition[]>([]);
  const [subaccountNames, setSubaccountNames] = useState<string[]>([]);
  const [activeSubaccount, setActiveSubaccount] = useState<string>('default');
  const [walletUsdcBalance, setWalletUsdcBalance] = useState(0);
  const [ethBalance, setEthBalance] = useState(0);
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

  // 4. Live Multi-Source Balance Fetcher: Discovers all Nado Subaccounts + Spot Assets + Perp Positions + Wallet On-Chain USDC + Native ETH
  const fetchBalance = useCallback(async () => {
    if (!isConnected || !normalizedAddress) {
      setIsBalanceLoading(false);
      return;
    }

    try {
      setIsBalanceLoading(true);
      setBalanceError(null);

      const rpcProvider = new ethers.JsonRpcProvider('https://rpc-gel.inkonchain.com');
      const erc20Abi = ['function balanceOf(address) view returns (uint256)'];
      const usdcContract1 = process.env.NEXT_PUBLIC_NADO_USDC_CONTRACT || '0x0200C29006150606B650577BBE7B6248F58470c1';
      const usdcContract2 = '0x2d270e6886d130d724215a266106e6832161eaed';

      const token1 = new ethers.Contract(usdcContract1, erc20Abi, rpcProvider);
      const token2 = new ethers.Contract(usdcContract2, erc20Abi, rpcProvider);

      // Parallel async query: Nado Portfolio (all subaccounts + spot assets + perps) + On-chain USDC + On-chain ETH
      const [portfolioRes, usdc1Res, usdc2Res, ethRes] = await Promise.allSettled([
        fetchUserNadoPortfolio(normalizedAddress),
        token1.balanceOf(normalizedAddress),
        token2.balanceOf(normalizedAddress),
        rpcProvider.getBalance(normalizedAddress),
      ]);

      // 1. Process Nado Portfolio (subaccounts, spot assets, perps, collateral)
      let liveNadoTotal = 0;
      let liveNadoFree = 0;
      let liveNadoMargin = 0;
      let liveSpots: NadoSpotAsset[] = [];
      let livePerps: NadoPerpPosition[] = [];
      let subs: string[] = [];
      let activeSub = 'default';

      if (portfolioRes.status === 'fulfilled' && portfolioRes.value) {
        const p = portfolioRes.value;
        liveNadoTotal = p.totalCollateral;
        liveNadoFree = p.freeCollateral;
        liveNadoMargin = p.marginUsage;
        liveSpots = p.spotAssets;
        livePerps = p.perpPositions;
        subs = p.allSubaccounts;
        activeSub = p.subaccountHex;
      }

      // 2. Process On-Chain Wallet USDC Balances (6 decimals)
      let walletUsdc = 0;
      if (usdc1Res.status === 'fulfilled' && usdc1Res.value) {
        walletUsdc += parseFloat(ethers.formatUnits(usdc1Res.value, 6));
      }
      if (usdc2Res.status === 'fulfilled' && usdc2Res.value) {
        walletUsdc += parseFloat(ethers.formatUnits(usdc2Res.value, 6));
      }

      // 3. Process Native Gas (ETH on Ink)
      let ethBal = 0;
      if (ethRes.status === 'fulfilled' && ethRes.value) {
        ethBal = parseFloat(ethers.formatEther(ethRes.value));
      }

      // 4. Update individual states
      setNadoCollateral(liveNadoTotal);
      setNadoFreeCollateral(liveNadoFree);
      setNadoMarginUsage(liveNadoMargin);
      setNadoSpotAssets(liveSpots);
      setNadoPositions(livePerps);
      setSubaccountNames(subs);
      setActiveSubaccount(activeSub);

      const activeNadoBal = liveNadoFree > 0 ? liveNadoFree : liveNadoTotal;
      setNadoBalance(activeNadoBal);
      setWalletUsdcBalance(walletUsdc);
      setEthBalance(ethBal);

      // Primary DEX balance is STRICTLY the live Nado balance! Never falsely show wallet balance as Nado!
      setBalance(activeNadoBal);

      setTokenBalances((prev) => ({
        ...prev,
        ETH: ethBal,
        USDC: walletUsdc,
        NADO: activeNadoBal,
      }));
    } catch (e) {
      console.warn('[WalletContext] Failed to fetch live wallet/Nado balances:', e);
      setBalanceError('Unable to load balance');
    } finally {
      setIsBalanceLoading(false);
    }
  }, [isConnected, normalizedAddress]);

  useEffect(() => {
    fetchBalance();
    const timer = setInterval(fetchBalance, 10000);
    const handleFocus = () => fetchBalance();
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', handleFocus);
    }
    return () => {
      clearInterval(timer);
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', handleFocus);
      }
    };
  }, [fetchBalance]);

  // 4b. Fetch Nado trade history for connected address
  useEffect(() => {
    if (!normalizedAddress) return;
    
    const senderHex = getSubaccountHex(normalizedAddress, 'default');

    fetch(`/api/profile/history?sender=${senderHex}`)
      .then(res => res.json())
      .then(json => {
        if (json.data && Array.isArray(json.data)) {
          const fetchedTxs: Transaction[] = json.data.map((fill: any) => {
            const assetName = fill.product_id === 1 ? 'NADO/USDC' : fill.product_id === 2 ? 'ETH/USDC' : fill.product_id === 3 ? 'SOL/USDC' : fill.product_id === 4 ? 'BTC/USDC' : 'Trade';
            return {
              id: fill.fill_id || `fill-${Math.random()}`,
              type: 'Trade',
              amount: fill.amount,
              asset: assetName,
              date: new Date(fill.timestamp * 1000), // convert seconds to ms
              status: 'Completed',
              network: 'Ink'
            };
          });
          
          setTransactions(prev => {
            const existingIds = new Set(prev.map(t => t.id));
            const newTxs = fetchedTxs.filter(t => !existingIds.has(t.id));
            if (newTxs.length === 0) return prev;
            return [...newTxs, ...prev].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          });
        }
      })
      .catch(err => console.warn('[WalletContext] Failed to fetch Nado history:', err));
  }, [normalizedAddress]);

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
    setNadoBalance(0);
    setNadoCollateral(0);
    setNadoFreeCollateral(0);
    setNadoMarginUsage(0);
    setNadoSpotAssets([]);
    setNadoPositions([]);
    setSubaccountNames([]);
    setActiveSubaccount('default');
    setWalletUsdcBalance(0);
    setEthBalance(0);
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
        nadoBalance,
        nadoCollateral,
        nadoFreeCollateral,
        nadoMarginUsage,
        nadoSpotAssets,
        nadoPositions,
        subaccountNames,
        activeSubaccount,
        setActiveSubaccount,
        walletUsdcBalance,
        ethBalance,
        isBalanceLoading,
        balanceError,
        transactions,
        stakedBalances,
        tokenBalances,
        connect,
        disconnect,
        setNetwork,
        switchToInk,
        refetchBalance: fetchBalance,
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
