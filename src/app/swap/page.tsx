"use client";

import React, { useState } from 'react';
import Navbar from '@/components/Navbar';
import { useLocalization } from '@/components/LocalizationContext';
import { useWallet } from '@/components/WalletContext';
import { ArrowDown, Settings, Zap } from 'lucide-react';

export default function SwapPage() {
  const { t, formatCurrency, slippage } = useLocalization();
  const { isConnected, balance, network, addTransaction, updateTokenBalance } = useWallet();
  
  const [payAmount, setPayAmount] = useState('');
  
  // Mock exchange rate: 1 USDC = 0.408 NADO (since NADO is ~$2.45)
  const exchangeRate = 0.408;
  const numPayAmount = parseFloat(payAmount) || 0;
  const receiveAmount = numPayAmount * exchangeRate;

  const handleSwap = () => {
    if (!isConnected) {
      alert("Please connect your wallet first!");
      return;
    }
    if (numPayAmount <= 0) {
      alert("Please enter a valid amount!");
      return;
    }
    if (numPayAmount > balance) {
      alert("Insufficient USDC balance!");
      return;
    }

    // Deduct USDC, log transaction
    addTransaction({
      type: 'Swap',
      amount: -numPayAmount,
      asset: 'USDC',
      network: network
    });

    // Add NADO token to token balances
    updateTokenBalance('NADO', receiveAmount);

    alert(`Successfully swapped ${numPayAmount} USDC for ${receiveAmount.toFixed(2)} NADO!`);
    setPayAmount('');
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans flex flex-col pb-20 relative">
      <Navbar />

      <main className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 relative w-full">
        {/* Background glow effects */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[150px] -z-10 mix-blend-screen pointer-events-none" />

        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-extrabold mb-2">{t('swapTitle')}</h1>
            <p className="text-gray-400">{t('swapSubtitle')}</p>
          </div>

          <div className="glass-panel p-6 rounded-3xl shadow-2xl border-t-primary/20 border-t relative">
            
            <div className="flex justify-between items-center mb-6">
              <span className="font-bold text-lg">{t('swapTitle')}</span>
              <div className="flex gap-3">
                <button className="text-gray-400 hover:text-white transition-colors" title="Settings">
                  <Settings size={20} />
                </button>
              </div>
            </div>

            {/* Pay Section */}
            <div className="bg-black/40 border border-white/5 rounded-2xl p-4 focus-within:border-primary/50 transition-colors mb-2">
              <div className="text-sm text-gray-400 mb-2 font-medium flex justify-between">
                <span>{t('youPay')}</span>
                <span>Balance: {formatCurrency(isConnected ? balance : 0)}</span>
              </div>
              <div className="flex justify-between items-center">
                <input 
                  type="number" 
                  placeholder="0.0" 
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="bg-transparent text-3xl font-bold outline-none w-full" 
                />
                <button className="flex items-center gap-2 glass-panel px-3 py-1.5 rounded-full whitespace-nowrap">
                  <div className="w-5 h-5 rounded-full bg-blue-500 shadow-lg shadow-blue-500/20" />
                  <span className="font-bold">USDC</span>
                </button>
              </div>
            </div>

            {/* Arrow Divider */}
            <div className="flex justify-center -my-3 relative z-10">
              <div className="w-10 h-10 rounded-xl bg-background border border-white/10 flex items-center justify-center text-gray-400 hover:text-primary hover:border-primary/50 transition-colors cursor-pointer shadow-xl">
                <ArrowDown size={20} />
              </div>
            </div>

            {/* Receive Section */}
            <div className="bg-black/40 border border-white/5 rounded-2xl p-4 mb-6">
              <div className="text-sm text-gray-400 mb-2 font-medium">{t('youReceive')}</div>
              <div className="flex justify-between items-center">
                <input 
                  type="number" 
                  placeholder="0.0" 
                  value={receiveAmount ? receiveAmount.toFixed(4) : ''}
                  readOnly
                  className="bg-transparent text-3xl font-bold outline-none w-full text-white/50" 
                />
                <button className="flex items-center gap-2 glass-panel px-3 py-1.5 rounded-full whitespace-nowrap">
                  <div className="w-5 h-5 rounded-full bg-primary shadow-lg shadow-primary/20 flex items-center justify-center text-background font-bold text-xs">N</div>
                  <span className="font-bold">NADO</span>
                </button>
              </div>
            </div>

            {/* Swap Details */}
            {numPayAmount > 0 && (
              <div className="mb-6 p-4 bg-white/5 rounded-xl text-sm space-y-2 border border-white/5">
                <div className="flex justify-between text-gray-400">
                  <span>Exchange Rate</span>
                  <span className="text-white">1 USDC = {exchangeRate} NADO</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Max Slippage</span>
                  <span className="text-white">{slippage}%</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Network Fee</span>
                  <span className="text-green-400 font-bold flex items-center gap-1"><Zap size={12}/> Free</span>
                </div>
              </div>
            )}

            <button 
              onClick={handleSwap}
              disabled={!isConnected && false}
              className={`w-full font-bold py-4 rounded-2xl transition-all duration-300 shadow-lg text-lg ${
                !isConnected 
                  ? 'bg-primary/20 text-primary hover:bg-primary/30' 
                  : numPayAmount <= 0 
                    ? 'bg-white/5 text-gray-500 cursor-not-allowed'
                    : 'bg-primary text-background hover:bg-primary/80 shadow-[0_0_20px_rgba(0,240,255,0.3)]'
              }`}
            >
              {!isConnected ? t('connect') : numPayAmount <= 0 ? 'Enter an amount' : t('confirmSwap')}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
