"use client";

import React, { useState } from 'react';
import Navbar from '@/components/Navbar';
import { useLocalization } from '@/components/LocalizationContext';
import { useWallet } from '@/components/WalletContext';
import { useTransactionFeedback } from '@/components/TransactionFeedbackContext';
import { Coins, Wallet, ArrowRight, TrendingUp, Flame, Info, Loader2 } from 'lucide-react';

const POOLS = [
  { id: 'usdc', asset: 'USDC', name: 'USD Coin', apy: 8.2, tvl: 0, color: 'from-blue-500 to-indigo-600' },
  { id: 'eth', asset: 'ETH', name: 'Ethereum', apy: 4.5, tvl: 0, color: 'from-purple-500 to-pink-500' },
];

export default function EarnPage() {
  const { t, formatCurrency } = useLocalization();
  const { isConnected, balance, tokenBalances, stakedBalances, updateStakedBalance, addTransaction, network } = useWallet();

  const [activePool, setActivePool] = useState(POOLS[0]);
  const [activeTab, setActiveTab] = useState<'stake' | 'unstake'>('stake');
  const [amount, setAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { simulateTransaction } = useTransactionFeedback();
  const activeBalance = activePool.asset === 'USDC' ? balance : (tokenBalances[activePool.asset] || 0);

  const handleAction = async () => {
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) return;

    setIsSubmitting(true);
    
    try {
      if (activeTab === 'stake') {
        if (numAmount > activeBalance) {
          alert(`Insufficient ${activePool.asset} balance!`);
          return;
        }
        await simulateTransaction(`Stake ${numAmount} ${activePool.asset}`);
        updateStakedBalance(activePool.id, numAmount);
        addTransaction({
          type: 'Stake',
          amount: numAmount,
          asset: activePool.asset,
          network: network
        });
      } else {
        if (numAmount > stakedBalances[activePool.id]) {
          alert("Insufficient staked balance!");
          return;
        }
        await simulateTransaction(`Unstake ${numAmount} ${activePool.asset}`);
        updateStakedBalance(activePool.id, -numAmount);
        addTransaction({
          type: 'Unstake',
          amount: numAmount,
          asset: activePool.asset,
          network: network
        });
      }
      setAmount('');
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalStakedUsd = Object.values(stakedBalances).reduce((acc, val) => acc + val, 0);

  return (
    <div className="min-h-screen text-foreground font-sans flex flex-col pb-20 relative">
      <Navbar />

      <main className="flex-1 flex flex-col p-6 md:p-12 relative max-w-7xl mx-auto w-full">
        {/* Background glow effects */}
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[150px] -z-10 mix-blend-screen pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-[150px] -z-10 mix-blend-screen pointer-events-none" />

        <div className="mb-10 text-center md:text-left flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-4xl md:text-5xl font-extrabold mb-4 tracking-tight flex items-center gap-4 justify-center md:justify-start">
              Simple Earn 
              <span className="text-sm font-bold bg-amber-500/20 text-amber-500 px-3 py-1 rounded-full border border-amber-500/30 tracking-normal align-middle uppercase">
                Demo
              </span>
            </h1>
            <p className="text-gray-400 text-lg max-w-2xl">
              Simulate staking assets in our demo liquidity pools. 
              This interface is for testing purposes only and does not interact with live smart contracts.
            </p>
          </div>
          
          {/* User's Staked Overview */}
          <div className="glass-panel px-8 py-5 rounded-3xl flex flex-col items-center md:items-end">
            <span className="text-sm text-gray-400 mb-1 flex items-center gap-2"><TrendingUp size={16} className="text-green-400"/> My Staked Assets (Demo)</span>
            <span className="text-3xl font-bold text-white">{formatCurrency(isConnected ? totalStakedUsd : 0)}</span>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          
          {/* Left Column: Pools List */}
          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><Flame size={20} className="text-orange-500"/> Demo Pools</h3>
            
            {POOLS.map((pool) => (
              <div 
                key={pool.id} 
                onClick={() => setActivePool(pool)}
                className={`glass-panel p-6 rounded-3xl cursor-pointer transition-all border ${activePool.id === pool.id ? 'border-primary shadow-[0_0_30px_rgba(0,240,255,0.15)] bg-white/10' : 'border-transparent hover:bg-white/5 hover:border-white/10'}`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                  
                  <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 rounded-2xl bg-gradient-to-tr ${pool.color} flex items-center justify-center shadow-lg`}>
                      <span className="font-bold text-white text-xl">{pool.asset[0]}</span>
                    </div>
                    <div>
                      <h4 className="text-xl font-bold text-white">{pool.asset} <span className="text-xs text-gray-400 bg-white/5 px-2 py-0.5 rounded ml-2">DEMO</span></h4>
                      <span className="text-sm text-gray-400">{pool.name}</span>
                    </div>
                  </div>

                  <div className="flex gap-8 sm:gap-12">
                    <div>
                      <div className="text-sm text-gray-400 mb-1">Simulated APY</div>
                      <div className="text-2xl font-bold text-green-400">{pool.apy}%</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-400 mb-1">TVL</div>
                      <div className="text-xl font-bold text-gray-500">N/A</div>
                    </div>
                  </div>
                  
                </div>
              </div>
            ))}

            <div className="mt-8 p-6 bg-amber-500/5 border border-amber-500/20 rounded-3xl flex gap-4">
              <Info size={32} className="text-amber-500 shrink-0" />
              <div>
                <h4 className="font-bold text-amber-500 mb-2">Demo Environment Active</h4>
                <p className="text-sm text-gray-400">
                  This page is a simulated UI demonstration. There are no underlying smart contracts deployed for this feature yet. The numbers shown above are not real TVL metrics.
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: Staking Interface */}
          <div className="lg:col-span-1 h-fit glass-panel rounded-3xl p-6 shadow-2xl relative border-t-primary/20 border-t">
            
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full bg-gradient-to-tr ${activePool.color} flex items-center justify-center`}>
                  <span className="font-bold text-white text-xs">{activePool.asset[0]}</span>
                </div>
                <span className="font-bold text-lg">{activePool.asset} Demo</span>
              </div>
              <div className="text-green-400 font-bold bg-green-500/10 px-2 py-1 rounded text-sm">
                {activePool.apy}% APY
              </div>
            </div>

            <div className="flex bg-black/40 rounded-xl p-1 mb-6">
              <button 
                onClick={() => setActiveTab('stake')}
                className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-1 ${activeTab === 'stake' ? 'bg-primary text-background shadow-lg shadow-primary/20' : 'text-gray-400 hover:text-gray-200'}`}
              >
                Stake
              </button>
              <button 
                onClick={() => setActiveTab('unstake')}
                className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-1 ${activeTab === 'unstake' ? 'bg-white/10 text-white shadow-lg' : 'text-gray-400 hover:text-gray-200'}`}
              >
                Unstake
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-black/40 border border-white/5 rounded-2xl p-4 focus-within:border-primary/50 transition-colors">
                <div className="text-sm text-gray-400 mb-2 font-medium flex justify-between">
                  <span>Amount</span>
                  <span>
                    {activeTab === 'stake' 
                      ? `Wallet: ${isConnected ? activeBalance.toFixed(2) : 0} ${activePool.asset}` 
                      : `Staked: ${isConnected ? (stakedBalances[activePool.id] || 0).toFixed(2) : 0} ${activePool.asset}`}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <input 
                    type="number" 
                    placeholder="0.0" 
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="bg-transparent text-3xl font-bold outline-none w-full text-white" 
                  />
                  <button 
                    onClick={() => {
                      if (!isConnected) return;
                      setAmount(activeTab === 'stake' ? activeBalance.toString() : (stakedBalances[activePool.id] || 0).toString());
                    }} 
                    className="text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded hover:bg-primary/20 transition-colors"
                  >
                    MAX
                  </button>
                </div>
              </div>

              <div className="pt-4 space-y-2 border-t border-white/5">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Simulated Daily Yield</span>
                  <span className="font-bold text-green-400">
                    +{formatCurrency((parseFloat(amount || '0') * (activePool.apy / 100)) / 365)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Network Fee</span>
                  <span className="font-bold text-gray-500">None (Demo)</span>
                </div>
              </div>

              <button
                onClick={handleAction}
                disabled={isSubmitting || !isConnected || !amount || parseFloat(amount) <= 0 || (activeTab === 'stake' ? parseFloat(amount) > activeBalance : parseFloat(amount) > (stakedBalances[activePool.id] || 0))}
                className={`w-full py-4 rounded-xl font-bold text-lg transition-all shadow-xl flex items-center justify-center gap-2 ${
                  isSubmitting ? 'bg-primary/50 text-white cursor-not-allowed' :
                  (!isConnected || !amount || parseFloat(amount) <= 0 || (activeTab === 'stake' ? parseFloat(amount) > activeBalance : parseFloat(amount) > (stakedBalances[activePool.id] || 0))) 
                    ? 'bg-white/10 text-gray-500 cursor-not-allowed' 
                    : 'bg-primary text-background hover:bg-primary/90 shadow-[0_0_15px_rgba(0,240,255,0.4)]'
                }`}
              >
                {isSubmitting ? (
                  <><Loader2 className="animate-spin" /> Processing...</>
                ) : activeTab === 'stake' ? (
                  parseFloat(amount) > activeBalance ? 'Insufficient Balance' : 'Confirm Stake'
                ) : (
                  parseFloat(amount) > (stakedBalances[activePool.id] || 0) ? 'Insufficient Staked Balance' : 'Confirm Unstake'
                )}
              </button>
            </div>
          </div>
          
        </div>
      </main>
    </div>
  );
}
