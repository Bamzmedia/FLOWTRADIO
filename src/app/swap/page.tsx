"use client";

import React, { useState, useEffect } from 'react';
import { useWallet } from '@/components/WalletContext';
import { useTransactionFeedback } from '@/components/TransactionFeedbackContext';
import { ArrowDown, Settings, Wallet, Loader2, CheckCircle2, ChevronDown, RefreshCw } from 'lucide-react';

const ASSETS = [
  { id: 'SOL', name: 'Solana', price: 148.90 },
  { id: 'ETH', name: 'Ethereum', price: 2620.50 },
  { id: 'BTC', name: 'Bitcoin', price: 80450.00 }
];

export default function SwapPage() {
  const { isConnected, balance, network, addTransaction } = useWallet();
  const { simulateTransaction } = useTransactionFeedback();
  const [payAmount, setPayAmount] = useState('');
  const [receiveAsset, setReceiveAsset] = useState(ASSETS[0]);
  const [showAssetDropdown, setShowAssetDropdown] = useState(false);
  const [slippage, setSlippage] = useState(0.5);
  const [showSettings, setShowSettings] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const receiveAmount = (parseFloat(payAmount) || 0) / receiveAsset.price;
  const priceImpact = (parseFloat(payAmount) || 0) > 10000 ? 0.12 + ((parseFloat(payAmount) - 10000) / 100000) : 0.05;
  const minReceived = receiveAmount * (1 - slippage / 100);
  const networkFee = 0.05; // $0.05

  const handleSwap = async () => {
    if (!payAmount || parseFloat(payAmount) <= 0) return;
    
    setIsSubmitting(true);
    
    try {
      await simulateTransaction(`Swap ${payAmount} USDC for ${receiveAsset.id}`);
      
      addTransaction({
        type: 'Swap',
        amount: -parseFloat(payAmount),
        asset: 'USDC',
        network: network,
      });
      
      setPayAmount('');
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen text-foreground font-sans flex flex-col pb-20 relative bg-background">
      <Navbar />

      <main className="flex-1 flex flex-col p-6 md:p-12 relative max-w-7xl mx-auto w-full items-center justify-center">
        {/* Background glow effects */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[120px] -z-10 mix-blend-screen pointer-events-none" />

        <div className="w-full max-w-md glass-panel rounded-3xl p-6 shadow-2xl relative border-t-primary/20 border-t">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-xl font-bold">Quick Swap</h1>
            <div className="relative">
              <button 
                onClick={() => setShowSettings(!showSettings)}
                className="p-2 text-gray-400 hover:text-white rounded-xl hover:bg-white/5 transition-colors"
              >
                <Settings size={18} />
              </button>
              
              {/* Slippage Settings Dropdown */}
              {showSettings && (
                <div className="absolute right-0 top-12 glass-panel p-4 rounded-xl w-64 z-20 shadow-xl border border-white/10">
                  <h3 className="text-sm font-bold mb-3">Transaction Settings</h3>
                  <div className="mb-2 text-xs text-gray-400">Slippage Tolerance</div>
                  <div className="flex gap-2 mb-2">
                    {[0.1, 0.5, 1.0].map(val => (
                      <button
                        key={val}
                        onClick={() => { setSlippage(val); setShowSettings(false); }}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${slippage === val ? 'bg-primary text-background' : 'bg-black/40 text-gray-300 hover:bg-white/10'}`}
                      >
                        {val}%
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Pay Section */}
          <div className="bg-black/40 border border-white/5 rounded-2xl p-4 mb-2 focus-within:border-primary/50 transition-colors">
            <div className="text-sm text-gray-400 mb-2 font-medium flex justify-between">
              <span>You pay</span>
              {isConnected && <span>Balance: {balance.toFixed(2)} USDC</span>}
            </div>
            <div className="flex justify-between items-center gap-4">
              <input 
                type="number"
                placeholder="0.0"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                className="bg-transparent text-3xl font-bold outline-none w-full text-white"
                disabled={isSubmitting}
              />
              <div className="flex items-center gap-2 bg-black/60 px-3 py-2 rounded-xl shrink-0">
                <div className="w-6 h-6 rounded-full bg-blue-500 shadow-lg shadow-blue-500/20 flex items-center justify-center text-xs font-bold text-white">U</div>
                <span className="font-bold">USDC</span>
              </div>
            </div>
          </div>

          {/* Down Arrow separator */}
          <div className="flex justify-center -my-3 relative z-10">
            <div className="bg-background border border-white/10 p-1.5 rounded-xl text-gray-400">
              <ArrowDown size={16} />
            </div>
          </div>

          {/* Receive Section */}
          <div className="bg-black/40 border border-white/5 rounded-2xl p-4 mt-2 focus-within:border-primary/50 transition-colors relative">
            <div className="text-sm text-gray-400 mb-2 font-medium">You receive</div>
            <div className="flex justify-between items-center gap-4">
              <input 
                type="text"
                placeholder="0.0"
                value={payAmount ? receiveAmount.toFixed(6) : ''}
                readOnly
                className="bg-transparent text-3xl font-bold outline-none w-full text-white"
              />
              <button 
                onClick={() => setShowAssetDropdown(!showAssetDropdown)}
                disabled={isSubmitting}
                className="flex items-center gap-2 bg-black/60 hover:bg-black/80 px-3 py-2 rounded-xl shrink-0 transition-colors"
              >
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center text-xs font-bold text-white shadow-inner">
                  {receiveAsset.id[0]}
                </div>
                <span className="font-bold">{receiveAsset.id}</span>
                <ChevronDown size={14} className="text-gray-400" />
              </button>
            </div>
            
            {/* Asset Dropdown */}
            {showAssetDropdown && (
              <div className="absolute right-4 top-16 glass-panel rounded-xl w-48 z-20 shadow-xl border border-white/10 overflow-hidden">
                {ASSETS.map(asset => (
                  <button
                    key={asset.id}
                    onClick={() => { setReceiveAsset(asset); setShowAssetDropdown(false); }}
                    className="w-full flex items-center justify-between p-3 hover:bg-white/10 transition-colors"
                  >
                    <span className="font-bold text-sm">{asset.id}</span>
                    <span className="text-xs text-gray-400">{asset.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Quote Details */}
          {parseFloat(payAmount) > 0 && (
            <div className="mt-4 p-4 rounded-xl bg-black/20 border border-white/5 space-y-2 text-sm text-gray-400 animate-in fade-in slide-in-from-top-2">
              <div className="flex justify-between items-center">
                <span>Rate</span>
                <span className="text-white font-mono">1 USDC = {(1 / receiveAsset.price).toFixed(6)} {receiveAsset.id}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Price impact</span>
                <span className={priceImpact > 1 ? 'text-red-400' : 'text-green-400'}>{priceImpact.toFixed(2)}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Minimum received</span>
                <span className="text-white font-mono">{minReceived.toFixed(6)} {receiveAsset.id}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Network fee</span>
                <span className="text-white font-mono">${networkFee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Slippage tolerance</span>
                <span className="text-white font-mono">{slippage}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Route</span>
                <span className="text-white">Nado Liquidity v2</span>
              </div>
            </div>
          )}

          {/* Action Button */}
          <div className="mt-6">
            {!isConnected ? (
              <button 
                className="w-full font-bold py-4 rounded-xl shadow-[0_0_15px_rgba(0,240,255,0.2)] flex justify-center items-center gap-2 bg-primary text-background hover:bg-primary/90 transition-colors"
              >
                <Wallet size={18} /> Connect Wallet to Swap
              </button>
            ) : (
              <button
                onClick={handleSwap}
                disabled={isSubmitting || !payAmount || parseFloat(payAmount) <= 0 || parseFloat(payAmount) > balance}
                className={`w-full py-4 rounded-xl font-bold text-lg transition-all duration-300 shadow-xl flex justify-center items-center gap-2 ${
                  isSubmitting ? 'bg-primary/50 text-white cursor-not-allowed' :
                  !payAmount || parseFloat(payAmount) <= 0 || parseFloat(payAmount) > balance ? 'bg-white/10 text-gray-500 cursor-not-allowed' :
                  'bg-primary text-background hover:bg-primary/90 shadow-[0_0_20px_rgba(0,240,255,0.3)]'
                }`}
              >
                {isSubmitting ? (
                  <><Loader2 className="animate-spin" /> Swapping...</>
                ) : parseFloat(payAmount) > balance ? (
                  'Insufficient USDC Balance'
                ) : (
                  'Review Swap'
                )}
              </button>
            )}
          </div>

        </div>
      </main>
    </div>
  );
}
