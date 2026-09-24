"use client";

import React, { useState } from 'react';
import { useWallet } from '@/components/WalletContext';
import { useLocalization } from '@/components/LocalizationContext';
import { useTransactionFeedback } from '@/components/TransactionFeedbackContext';
import Navbar from '@/components/Navbar';
import { 
  ArrowDownToLine, 
  ArrowUpFromLine, 
  ArrowRightLeft, 
  Clock, 
  ShieldCheck, 
  AlertCircle, 
  Loader2, 
  Coins, 
  TrendingUp, 
  RefreshCw, 
  Layers, 
  ExternalLink, 
  Wallet, 
  CheckCircle2, 
  ArrowUpRight 
} from 'lucide-react';
import Link from 'next/link';

export default function WalletPage() {
  const { 
    isConnected, 
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
    network, 
    transactions, 
    addTransaction,
    refetchBalance
  } = useWallet();
  const { formatCurrency, formatDate } = useLocalization();
  const { simulateTransaction } = useTransactionFeedback();
  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw' | 'transfer'>('deposit');
  const [amount, setAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  if (!isConnected) {
    return (
      <div className="min-h-screen text-foreground font-sans flex flex-col pb-20 relative">
        <Navbar />
        <main className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <ShieldCheck size={64} className="text-gray-500 mb-4 opacity-50" />
          <h2 className="text-2xl font-bold mb-2">Wallet Disconnected</h2>
          <p className="text-gray-400 max-w-md mb-6">Please connect your wallet using the button in the top right corner to view your assets and transaction history.</p>
        </main>
      </div>
    );
  }

  // Pure Nado free collateral available to withdraw
  const availableToWithdraw = nadoFreeCollateral > 0 ? nadoFreeCollateral : nadoCollateral;
  
  const activeAvailable = activeTab === 'deposit' 
    ? walletUsdcBalance 
    : availableToWithdraw;

  const handleAction = async () => {
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      alert("Please enter a valid amount!");
      return;
    }
    if (activeTab === 'withdraw' && numAmount > availableToWithdraw) {
      alert("Insufficient free Nado margin for withdrawal!");
      return;
    }
    if (activeTab === 'deposit' && walletUsdcBalance > 0 && numAmount > walletUsdcBalance) {
      alert("Insufficient USDC in MetaMask wallet for deposit!");
      return;
    }
    
    setIsSubmitting(true);
    try {
      if (activeTab === 'transfer') {
        await simulateTransaction(`Transfer ${numAmount} USDC`);
        addTransaction({ type: 'Transfer', amount: -numAmount, asset: 'USDC', network: network });
        setAmount('');
        return;
      }

      const providerSource = typeof window !== 'undefined' ? (window as any).ethereum : null;
      if (!providerSource) throw new Error('No Web3 wallet provider available.');

      const { ethers } = await import('ethers');
      const provider = new ethers.BrowserProvider(providerSource);
      const signer = await provider.getSigner();
      const endpointContract = process.env.NEXT_PUBLIC_NADO_ENDPOINT_CONTRACT;

      if (!endpointContract || endpointContract === '0x0000000000000000000000000000000000000000') {
        throw new Error('On-chain collateral contract deployment is pending. Direct settlement unavailable.');
      }

      if (activeTab === 'deposit') {
        const usdcContract = process.env.NEXT_PUBLIC_NADO_USDC_CONTRACT || '0x0200C29006150606B650577BBE7B6248F58470c1';
        const erc20Abi = [
          'function approve(address spender, uint256 amount) public returns (bool)',
          'function allowance(address owner, address spender) public view returns (uint256)'
        ];
        const token = new ethers.Contract(usdcContract, erc20Abi, signer);
        const tokenAmount = ethers.parseUnits(numAmount.toFixed(6), 6);

        const currentAllowance = await token.allowance(await signer.getAddress(), endpointContract);
        if (currentAllowance < tokenAmount) {
          const txApprove = await token.approve(endpointContract, tokenAmount);
          await txApprove.wait();
        }

        const endpointAbi = [
          'function depositCollateral(bytes12 subaccountName, uint32 productId, uint128 amount) external',
        ];
        const endpoint = new ethers.Contract(endpointContract, endpointAbi, signer);
        
        let nameHex = '';
        for (let i = 0; i < 12; i++) {
          if (i < 'default'.length) {
            nameHex += 'default'.charCodeAt(i).toString(16).padStart(2, '0');
          } else {
            nameHex += '00';
          }
        }
        const subaccountBytes12 = '0x' + nameHex;

        const tx = await endpoint.depositCollateral(subaccountBytes12, 0, tokenAmount);
        await tx.wait();
      } else if (activeTab === 'withdraw') {
        const { withdrawCollateral } = await import('@/nado/nadoApi');
        const sender = await signer.getAddress();
        const amountX18 = ethers.parseUnits(numAmount.toFixed(18), 18).toString();
        await withdrawCollateral(0, amountX18, sender, signer);
      }

      if (typeof refetchBalance === 'function') refetchBalance();
      
      addTransaction({
        type: activeTab === 'deposit' ? 'Deposit' : 'Withdraw',
        amount: activeTab === 'deposit' ? numAmount : -numAmount,
        asset: 'USDC',
        network: network,
      });
      
      alert(`${activeTab === 'deposit' ? 'Deposit' : 'Withdraw'} of $${numAmount.toFixed(2)} USDC confirmed!`);
      setAmount('');
    } catch (e: any) {
      console.error(e);
      alert(e.message || 'Transaction failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen text-foreground font-sans flex flex-col pb-20 relative">
      <Navbar />

      <main className="flex-1 flex flex-col p-6 md:p-12 relative max-w-7xl mx-auto w-full">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-primary/10 rounded-full blur-[150px] -z-10 mix-blend-screen pointer-events-none" />

        {/* Page Header */}
        <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-4xl font-extrabold tracking-tight">Asset Management</h1>
              <button 
                onClick={() => refetchBalance()} 
                title="Refresh balances from Nado Sequencer"
                className="p-2 rounded-xl glass-panel hover:bg-white/10 text-gray-400 hover:text-primary transition-all flex items-center gap-1.5 text-xs font-semibold"
              >
                <RefreshCw size={14} className={isBalanceLoading ? "animate-spin text-primary" : ""} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            </div>
            <p className="text-gray-400 flex items-center gap-2 text-sm">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> 
              Connected to Ink L2 • Nado DEX Matching Engine
              {subaccountNames.length > 1 && (
                <span className="ml-2 px-2 py-0.5 rounded-full bg-white/10 text-primary text-xs font-mono">
                  {subaccountNames.length} Subaccounts
                </span>
              )}
            </p>
          </div>

          <div className="glass-panel px-6 py-4 rounded-2xl flex flex-col items-end border border-primary/20 shadow-lg">
            <span className="text-xs uppercase tracking-wider text-gray-400 mb-1 font-semibold">Nado DEX Total Collateral</span>
            <span className="text-3xl font-black text-white font-mono">
              {formatCurrency(nadoCollateral)}
            </span>
          </div>
        </div>

        {/* 3 Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
          {/* Card 1: Nado DEX Margin */}
          <div className="glass-panel p-6 rounded-3xl border border-primary/30 relative overflow-hidden shadow-xl bg-gradient-to-br from-primary/5 via-transparent to-transparent">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_rgba(0,240,255,0.8)]" /> 
                Nado DEX Collateral
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/20 text-primary">DEX Trading</span>
            </div>
            <div className="text-3xl font-black text-white font-mono mb-2">
              {formatCurrency(nadoCollateral)}
            </div>
            <div className="flex justify-between items-center text-xs text-gray-400 pt-2 border-t border-white/5">
              <span>Free Trading Margin:</span>
              <span className="text-green-400 font-mono font-bold">${nadoFreeCollateral.toFixed(2)}</span>
            </div>
            {nadoMarginUsage > 0 && (
              <div className="flex justify-between items-center text-xs text-gray-400 mt-1">
                <span>Locked in Positions:</span>
                <span className="text-amber-400 font-mono font-bold">${nadoMarginUsage.toFixed(2)}</span>
              </div>
            )}
          </div>

          {/* Card 2: MetaMask Wallet USDC */}
          <div className="glass-panel p-6 rounded-3xl border border-white/10 relative overflow-hidden shadow-xl">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.8)]" /> 
                MetaMask Wallet USDC
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300">On-Chain</span>
            </div>
            <div className="text-3xl font-black text-white font-mono mb-2">
              {formatCurrency(walletUsdcBalance)}
            </div>
            <div className="flex justify-between items-center text-xs text-gray-400 pt-2 border-t border-white/5">
              <span>Available to Deposit:</span>
              <span className="text-blue-300 font-mono font-bold">${walletUsdcBalance.toFixed(2)}</span>
            </div>
          </div>

          {/* Card 3: Ink Gas Reserve */}
          <div className="glass-panel p-6 rounded-3xl border border-white/10 relative overflow-hidden shadow-xl">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-purple-400 shadow-[0_0_8px_rgba(192,132,252,0.8)]" /> 
                Ink Gas Reserve
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300">Native Gas</span>
            </div>
            <div className="text-3xl font-black text-gray-200 font-mono mb-2">
              {ethBalance.toFixed(4)} <span className="text-lg font-bold text-gray-400">ETH</span>
            </div>
            <div className="flex justify-between items-center text-xs text-gray-400 pt-2 border-t border-white/5">
              <span>Ink Network Fee Status:</span>
              <span className="text-green-400 font-bold">Ready</span>
            </div>
          </div>
        </div>

        {/* Zero Nado Balance Notice Banner */}
        {nadoCollateral === 0 && (
          <div className="mb-8 p-5 rounded-2xl glass-panel border border-primary/30 bg-primary/5 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
                <Coins size={22} className="text-primary" />
              </div>
              <div>
                <h4 className="font-bold text-white text-sm">No Assets Deposited on Nado DEX Yet</h4>
                <p className="text-xs text-gray-400">
                  {walletUsdcBalance > 0 
                    ? `You have ${formatCurrency(walletUsdcBalance)} USDC in your MetaMask wallet. Deposit it into Nado below to start trading.` 
                    : "Deposit USDC into Nado DEX to access up to 100x leverage on perpetual contracts."}
                </p>
              </div>
            </div>
            <button
              onClick={() => { setActiveTab('deposit'); setAmount(walletUsdcBalance > 0 ? walletUsdcBalance.toString() : '50'); }}
              className="px-5 py-2.5 rounded-xl bg-primary text-background font-bold text-xs hover:bg-primary/90 transition-all shadow-[0_0_15px_rgba(0,240,255,0.4)] shrink-0"
            >
              Deposit USDC to Nado
            </button>
          </div>
        )}

        {/* NADO ASSETS TABLE (Spot Holdings on Nado) */}
        <div className="mb-10 glass-panel rounded-3xl overflow-hidden border border-white/10 shadow-2xl">
          <div className="p-6 border-b border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Coins size={20} className="text-primary" />
                <span>Nado DEX Assets & Spot Holdings</span>
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Assets currently deposited and active inside your Nado DEX subaccount
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary font-mono font-bold">
                {nadoSpotAssets.length} Active {nadoSpotAssets.length === 1 ? 'Asset' : 'Assets'}
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-black/30 text-gray-400 text-xs uppercase tracking-wider border-b border-white/5">
                  <th className="py-4 px-6 font-semibold">Asset</th>
                  <th className="py-4 px-6 font-semibold text-right">Deposited Balance</th>
                  <th className="py-4 px-6 font-semibold text-right">Oracle Price</th>
                  <th className="py-4 px-6 font-semibold text-right">USD Value</th>
                  <th className="py-4 px-6 font-semibold text-center">Action</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-white/5">
                {nadoSpotAssets.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-gray-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Coins size={36} className="text-gray-600 mb-1" />
                        <span className="font-semibold text-gray-300">No Spot Holdings on Nado</span>
                        <span className="text-xs text-gray-500 max-w-sm">
                          Use the deposit panel below to deposit USDC from MetaMask into your Nado trading account.
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  nadoSpotAssets.map((asset) => (
                    <tr key={asset.productId} className="hover:bg-white/5 transition-colors">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-primary/30 to-secondary/30 flex items-center justify-center font-bold text-xs text-white">
                            {asset.symbol.slice(0, 3)}
                          </div>
                          <div>
                            <div className="font-bold text-white">{asset.symbol}</div>
                            <div className="text-xs text-gray-400">{asset.name}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-right font-mono font-bold text-white">
                        {asset.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                      </td>
                      <td className="py-4 px-6 text-right font-mono text-gray-300">
                        {formatCurrency(asset.price)}
                      </td>
                      <td className="py-4 px-6 text-right font-mono font-bold text-green-400">
                        {formatCurrency(asset.valueUsd)}
                      </td>
                      <td className="py-4 px-6 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => { setActiveTab('deposit'); setAmount(''); }}
                            className="px-2.5 py-1 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold transition-colors"
                          >
                            Deposit
                          </button>
                          <button
                            onClick={() => { setActiveTab('withdraw'); setAmount(Math.min(asset.amount, availableToWithdraw).toFixed(2)); }}
                            className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white text-xs font-bold transition-colors"
                          >
                            Withdraw
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* NADO PERP POSITIONS TABLE */}
        {nadoPositions.length > 0 && (
          <div className="mb-10 glass-panel rounded-3xl overflow-hidden border border-white/10 shadow-2xl">
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <TrendingUp size={20} className="text-green-400" />
                  <span>Nado Open Perpetual Positions</span>
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">Active leveraged contracts on Nado DEX</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-black/30 text-gray-400 text-xs uppercase tracking-wider border-b border-white/5">
                    <th className="py-4 px-6 font-semibold">Market</th>
                    <th className="py-4 px-6 font-semibold">Side</th>
                    <th className="py-4 px-6 font-semibold text-right">Size</th>
                    <th className="py-4 px-6 font-semibold text-right">Entry Price</th>
                    <th className="py-4 px-6 font-semibold text-right">Mark Price</th>
                    <th className="py-4 px-6 font-semibold text-right">Unrealized PnL</th>
                    <th className="py-4 px-6 font-semibold text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="text-sm divide-y divide-white/5">
                  {nadoPositions.map((pos) => (
                    <tr key={pos.productId} className="hover:bg-white/5 transition-colors">
                      <td className="py-4 px-6 font-bold text-white">{pos.symbol}</td>
                      <td className="py-4 px-6">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${pos.side === 'long' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                          {pos.side.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right font-mono font-bold text-white">{pos.amount.toFixed(4)}</td>
                      <td className="py-4 px-6 text-right font-mono text-gray-300">{formatCurrency(pos.entryPrice)}</td>
                      <td className="py-4 px-6 text-right font-mono text-gray-300">{formatCurrency(pos.markPrice)}</td>
                      <td className={`py-4 px-6 text-right font-mono font-bold ${pos.unrealizedPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {pos.unrealizedPnl >= 0 ? '+' : ''}{formatCurrency(pos.unrealizedPnl)}
                      </td>
                      <td className="py-4 px-6 text-center">
                        <Link
                          href={`/trade?market=${pos.symbol}`}
                          className="px-3 py-1 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold inline-flex items-center gap-1 transition-colors"
                        >
                          Trade <ArrowUpRight size={12} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Deposit / Withdraw & Transaction History Grid */}
        <div className="grid lg:grid-cols-3 gap-8">
          
          {/* Action Interface (Deposit/Withdraw/Transfer) */}
          <div className="lg:col-span-1 h-fit glass-panel rounded-3xl p-6 shadow-2xl relative border-t-primary/20 border-t">
            
            <div className="flex bg-black/40 rounded-xl p-1 mb-6">
              <button 
                onClick={() => setActiveTab('deposit')}
                className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${activeTab === 'deposit' ? 'bg-primary text-background shadow-lg shadow-primary/20' : 'text-gray-400 hover:text-gray-200'}`}
              >
                <ArrowDownToLine size={14} /> Deposit
              </button>
              <button 
                onClick={() => setActiveTab('withdraw')}
                className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${activeTab === 'withdraw' ? 'bg-white/10 text-white shadow-lg' : 'text-gray-400 hover:text-gray-200'}`}
              >
                <ArrowUpFromLine size={14} /> Withdraw
              </button>
              <button 
                onClick={() => setActiveTab('transfer')}
                className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${activeTab === 'transfer' ? 'bg-white/10 text-white shadow-lg' : 'text-gray-400 hover:text-gray-200'}`}
              >
                <ArrowRightLeft size={14} /> Transfer
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-black/40 border border-white/5 rounded-2xl p-4 focus-within:border-primary/50 transition-colors">
                <div className="text-sm text-gray-400 mb-2 font-medium">Asset</div>
                <div className="flex items-center gap-2 glass-panel w-full px-4 py-3 rounded-xl justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-blue-500 shadow-lg shadow-blue-500/20 flex items-center justify-center text-white text-xs font-bold">
                      $
                    </div>
                    <div>
                      <span className="font-bold text-lg text-white">USDC</span>
                      <span className="text-xs text-gray-400 block">USD Coin (Nado Primary Settlement)</span>
                    </div>
                  </div>
                </div>
              </div>

              {activeTab === 'transfer' && (
                <div className="bg-black/40 border border-white/5 rounded-2xl p-4 focus-within:border-primary/50 transition-colors">
                  <div className="text-sm text-gray-400 mb-2 font-medium flex justify-between">
                    <span>Destination Address</span>
                  </div>
                  <input type="text" placeholder="0x..." className="bg-transparent text-lg font-mono outline-none w-full" />
                </div>
              )}

              <div className="bg-black/40 border border-white/5 rounded-2xl p-4 focus-within:border-primary/50 transition-colors">
                <div className="text-sm text-gray-400 mb-2 font-medium flex justify-between items-center">
                  <span>Amount</span>
                  <span className="text-xs font-mono">
                    {activeTab === 'deposit' 
                      ? `MetaMask Wallet: ${formatCurrency(walletUsdcBalance)}` 
                      : `Nado Free Margin: ${formatCurrency(availableToWithdraw)}`}
                  </span>
                </div>
                <div className="flex justify-between items-center gap-3">
                  <input 
                    type="number" 
                    placeholder="0.0" 
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="bg-transparent text-3xl font-bold outline-none w-full font-mono text-white" 
                  />
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button 
                      onClick={() => setAmount((activeAvailable * 0.5).toFixed(2))} 
                      className="text-xs font-bold text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 px-2 py-1 rounded transition-colors"
                    >
                      50%
                    </button>
                    <button 
                      onClick={() => setAmount(activeAvailable.toString())} 
                      className="text-xs font-bold text-primary bg-primary/10 hover:bg-primary/20 px-2.5 py-1 rounded transition-colors shadow-sm"
                    >
                      MAX
                    </button>
                  </div>
                </div>
              </div>

              {activeTab === 'withdraw' && (
                <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs">
                  <AlertCircle size={14} className="shrink-0 mt-0.5" />
                  <p>Withdrawals from Nado are processed through the off-chain sequencer and settled directly to your connected wallet.</p>
                </div>
              )}

              <button 
                onClick={handleAction}
                disabled={isSubmitting || !amount || parseFloat(amount) <= 0 || (activeTab === 'withdraw' && parseFloat(amount) > availableToWithdraw)}
                className={`w-full py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2 ${
                  isSubmitting ? 'bg-primary/50 text-white cursor-not-allowed' :
                  (!amount || parseFloat(amount) <= 0 || (activeTab === 'withdraw' && parseFloat(amount) > availableToWithdraw)) 
                    ? 'bg-white/10 text-gray-500 cursor-not-allowed' 
                    : 'bg-primary text-background hover:bg-primary/90 shadow-[0_0_15px_rgba(0,240,255,0.4)]'
                }`}
              >
                {isSubmitting ? (
                  <><Loader2 className="animate-spin" /> Processing...</>
                ) : activeTab === 'withdraw' && parseFloat(amount) > availableToWithdraw ? (
                  'Insufficient Free Margin'
                ) : (
                  `Confirm ${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}`
                )}
              </button>
            </div>
          </div>

          {/* Transaction History Table */}
          <div className="lg:col-span-2 glass-panel rounded-3xl overflow-hidden flex flex-col border-t-white/10 border-t shadow-2xl">
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <h3 className="text-lg font-bold flex items-center gap-2"><Clock size={18} /> Transaction History</h3>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-black/20 text-gray-400 text-xs uppercase tracking-wider border-b border-white/5">
                    <th className="py-4 px-6 font-medium">Type</th>
                    <th className="py-4 px-6 font-medium text-right">Amount</th>
                    <th className="py-4 px-6 font-medium">Date</th>
                    <th className="py-4 px-6 font-medium">Network</th>
                    <th className="py-4 px-6 font-medium text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="text-sm divide-y divide-white/5">
                  {transactions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-gray-500">
                        No transactions recorded yet.
                      </td>
                    </tr>
                  ) : (
                    transactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-white/5 transition-colors">
                        <td className="py-4 px-6 font-medium">
                          <span className={`px-2 py-1 rounded text-xs ${tx.type === 'Deposit' ? 'bg-green-500/10 text-green-400' : tx.type === 'Withdraw' ? 'bg-red-500/10 text-red-400' : tx.type === 'Trade' ? 'bg-blue-500/10 text-blue-400' : 'bg-gray-500/10 text-gray-300'}`}>
                            {tx.type}
                          </span>
                          {(tx.takeProfit || tx.stopLoss) && (
                            <div className="text-[10px] text-gray-500 mt-2 font-mono">
                              {tx.takeProfit && <span className="mr-2">TP: <span className="text-green-500/70">{tx.takeProfit}</span></span>} 
                              {tx.stopLoss && <span>SL: <span className="text-red-500/70">{tx.stopLoss}</span></span>}
                            </div>
                          )}
                        </td>
                        <td className={`py-4 px-6 text-right font-mono font-medium ${tx.amount > 0 ? 'text-green-400' : tx.amount < 0 ? 'text-white' : ''}`}>
                          {tx.amount > 0 ? '+' : ''}{formatCurrency(tx.amount)} {tx.asset}
                        </td>
                        <td className="py-4 px-6 text-gray-400 text-xs">
                          {formatDate(tx.date)}
                        </td>
                        <td className="py-4 px-6">
                          <span className="text-xs bg-white/5 px-2 py-1 rounded border border-white/10">{tx.network}</span>
                        </td>
                        <td className="py-4 px-6 text-right">
                          <span className={`text-xs font-bold ${tx.status === 'Completed' ? 'text-green-400' : tx.status === 'Pending' ? 'text-yellow-400 animate-pulse' : 'text-red-400'}`}>
                            {tx.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
          
        </div>
      </main>
    </div>
  );
}
