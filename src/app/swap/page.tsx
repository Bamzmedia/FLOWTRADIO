"use client";

import React, { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import { useLocalization } from '@/components/LocalizationContext';
import { useWallet } from '@/components/WalletContext';
import { ArrowDown, Settings, Zap, Clock, AlertTriangle, RefreshCw } from 'lucide-react';

export default function SwapPage() {
  const { t, formatCurrency, slippage } = useLocalization();
  const { isConnected, balance, network, addTransaction, updateTokenBalance } = useWallet();
  
  const [payAmount, setPayAmount] = useState('');
  
  // Rate Lock Expiration Timer (10 minutes = 600 seconds)
  const [timeLeft, setTimeLeft] = useState<number>(600);
  const [isPriceExpired, setIsPriceExpired] = useState<boolean>(false);
  
  // Mock exchange rate: 1 USDC = 0.408 NADO (since NADO is ~$2.45)
  const exchangeRate = 0.408;
  const numPayAmount = parseFloat(payAmount) || 0;
  const receiveAmount = numPayAmount * exchangeRate;

  // 10-minute countdown timer loop
  useEffect(() => {
    if (timeLeft <= 0) {
      setIsPriceExpired(true);
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          setIsPriceExpired(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft]);

  const handleAcceptUpdatedRate = () => {
    setTimeLeft(600); // Reset 10-minute timer
    setIsPriceExpired(false);
  };

  const handleSwap = () => {
    if (isPriceExpired) {
      handleAcceptUpdatedRate();
      return;
    }
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
    handleAcceptUpdatedRate(); // Reset rate timer after swap
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
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
              
              {/* Rate Lock Timer Badge */}
              <div className="flex items-center gap-2">
                <span className={`text-xs font-mono px-2.5 py-1 rounded-full border flex items-center gap-1.5 font-bold ${
                  isPriceExpired 
                    ? 'bg-red-500/10 border-red-500/30 text-red-400' 
                    : 'bg-primary/10 border-primary/30 text-primary'
                }`}>
                  <Clock size={12} />
                  {isPriceExpired ? '00:00' : formatTimer(timeLeft)}
                </span>

                <button className="text-gray-400 hover:text-white transition-colors" title="Settings">
                  <Settings size={18} />
                </button>
              </div>
            </div>

            {/* Price Expired Warning Banner */}
            {isPriceExpired && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-center justify-between gap-2 text-xs text-red-400">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={16} className="flex-shrink-0" />
                  <span>Price expired. Click 'Accept Updated Rate' to continue.</span>
                </div>
              </div>
            )}

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
              className={`w-full font-bold py-4 rounded-2xl transition-all duration-300 shadow-lg text-lg flex items-center justify-center gap-2 ${
                isPriceExpired
                  ? 'bg-yellow-500 text-background hover:bg-yellow-400 shadow-[0_0_20px_rgba(234,179,8,0.4)] cursor-pointer'
                  : !isConnected 
                    ? 'bg-primary/20 text-primary hover:bg-primary/30' 
                    : numPayAmount <= 0 
                      ? 'bg-white/5 text-gray-500 cursor-not-allowed'
                      : 'bg-primary text-background hover:bg-primary/80 shadow-[0_0_20px_rgba(0,240,255,0.3)]'
              }`}
            >
              {isPriceExpired ? (
                <>
                  <RefreshCw size={18} />
                  Accept Updated Rate
                </>
              ) : !isConnected ? (
                t('connect')
              ) : numPayAmount <= 0 ? (
                'Enter an amount'
              ) : (
                t('confirmSwap')
              )}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
