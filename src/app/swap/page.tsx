"use client";

import React, { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import { useLocalization } from '@/components/LocalizationContext';
import { useWallet } from '@/components/WalletContext';
import { ArrowDown, Settings, Zap, Clock, AlertTriangle, RefreshCw, ChevronDown } from 'lucide-react';
import { useNadoWebSocket } from '@/hooks/useNadoWebSocket';
import { useNadoMarketData } from '@/hooks/useNadoMarketData';
import { NadoOrder } from '@/types/nado';

const ASSETS = [
  { symbol: 'USDC', color: 'bg-blue-500', isBase: true },
  { symbol: 'ETH', color: 'bg-purple-500', productId: 4 },
  { symbol: 'BTC', color: 'bg-orange-500', productId: 2 },
  { symbol: 'SOL', color: 'bg-green-500', productId: 1 },
];

export default function SwapPage() {
  const { t, formatCurrency, slippage } = useLocalization();
  const { isConnected, balance, network, addTransaction, updateTokenBalance, address } = useWallet();
  const wsClient = useNadoWebSocket();
  const { orderBooks } = useNadoMarketData([1, 2, 4]);
  
  const [payAsset, setPayAsset] = useState(ASSETS[0]); // USDC
  const [receiveAsset, setReceiveAsset] = useState(ASSETS[1]); // ETH
  const [payAmount, setPayAmount] = useState('');
  
  const [selectedSlippage, setSelectedSlippage] = useState<number>(0.5); // 0.1%, 0.5%, 1.0%
  const [showSettings, setShowSettings] = useState(false);
  
  const [timeLeft, setTimeLeft] = useState<number>(600);
  const [isPriceExpired, setIsPriceExpired] = useState<boolean>(false);
  const [isSwapping, setIsSwapping] = useState<boolean>(false);

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
    setTimeLeft(600);
    setIsPriceExpired(false);
  };

  const activeProductId = payAsset.isBase ? receiveAsset.productId! : payAsset.productId!;
  const isBuyingAsset = payAsset.isBase; // USDC -> ETH is buying ETH

  // Compute exchange rate and price impact
  let basePrice = 0;
  let priceImpact = 0;
  let receiveAmount = 0;
  let executionPrice = 0;
  
  const book = orderBooks[activeProductId];
  const numPayAmount = parseFloat(payAmount) || 0;

  if (book && book.asks.length > 0 && book.bids.length > 0) {
    const topAsk = book.asks[0][0];
    const topBid = book.bids[0][0];
    const midPrice = (topAsk + topBid) / 2;
    basePrice = midPrice;

    if (numPayAmount > 0) {
      // Simple order book depth impact calculation
      let remainingAmount = isBuyingAsset ? numPayAmount : numPayAmount;
      let totalCost = 0;
      let assetReceived = 0;
      
      if (isBuyingAsset) {
        // USDC to Asset (Buy)
        for (let i = 0; i < book.asks.length && remainingAmount > 0; i++) {
          const [px, size] = book.asks[i];
          const usdcAvailableAtLevel = px * size;
          if (remainingAmount <= usdcAvailableAtLevel) {
            assetReceived += remainingAmount / px;
            totalCost += remainingAmount;
            remainingAmount = 0;
          } else {
            assetReceived += size;
            totalCost += usdcAvailableAtLevel;
            remainingAmount -= usdcAvailableAtLevel;
          }
        }
        receiveAmount = assetReceived;
        executionPrice = totalCost / receiveAmount;
      } else {
        // Asset to USDC (Sell)
        for (let i = 0; i < book.bids.length && remainingAmount > 0; i++) {
          const [px, size] = book.bids[i];
          const assetAvailableAtLevel = size;
          if (remainingAmount <= assetAvailableAtLevel) {
            assetReceived += remainingAmount * px;
            totalCost += remainingAmount;
            remainingAmount = 0;
          } else {
            assetReceived += size * px;
            totalCost += size;
            remainingAmount -= size;
          }
        }
        receiveAmount = assetReceived;
        executionPrice = assetReceived / totalCost; // Price in terms of USDC per asset
      }
      
      priceImpact = Math.abs((executionPrice - midPrice) / midPrice) * 100;
    }
  } else {
    // Fallback if no order book (e.g. not connected or mock prices)
    basePrice = receiveAsset.symbol === 'ETH' ? 2400 : receiveAsset.symbol === 'BTC' ? 62000 : receiveAsset.symbol === 'SOL' ? 145 : 1;
    if (!payAsset.isBase) {
      basePrice = payAsset.symbol === 'ETH' ? 2400 : payAsset.symbol === 'BTC' ? 62000 : payAsset.symbol === 'SOL' ? 145 : 1;
    }
    const mockRate = isBuyingAsset ? 1 / basePrice : basePrice;
    receiveAmount = numPayAmount * mockRate;
    executionPrice = basePrice;
    priceImpact = (numPayAmount / 10000) * 0.1; // mock impact
  }

  const handleSwapAssets = () => {
    const temp = payAsset;
    setPayAsset(receiveAsset);
    setReceiveAsset(temp);
    setPayAmount('');
  };

  const handleSwap = async () => {
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
    if (priceImpact > selectedSlippage) {
      alert(`Price impact (${priceImpact.toFixed(2)}%) is higher than your slippage tolerance (${selectedSlippage}%).`);
      return;
    }

    setIsSwapping(true);
    
    try {
      // Create Nado Order
      const limitPrice = isBuyingAsset 
        ? executionPrice * (1 + (selectedSlippage / 100))
        : executionPrice * (1 - (selectedSlippage / 100));
        
      const amountX18 = BigInt(Math.floor((isBuyingAsset ? receiveAmount : -numPayAmount) * 1e18));
      const priceX18 = BigInt(Math.floor(limitPrice * 1e18));
      const expiration = Math.floor(Date.now() / 1000) + 60; // 60s
      
      const senderName = "default";
      let senderBytes32 = "0x" + "00".repeat(32);
      if (address) {
        // Safe check for window/Buffer in browser
        const addrHex = address.replace("0x", "");
        let nameHex = "";
        for (let i = 0; i < senderName.length; i++) {
          nameHex += senderName.charCodeAt(i).toString(16);
        }
        nameHex = nameHex.padEnd(24, "0");
        senderBytes32 = "0x" + addrHex + nameHex;
      }

      const order: NadoOrder = {
        sender: senderBytes32,
        priceX18: priceX18.toString(),
        amount: amountX18.toString(),
        expiration: expiration.toString(),
        nonce: (Date.now() * 1000000).toString(),
      };

      // Mock signature for demo purposes
      const signature = '0x' + '1b'.repeat(65);
      
      wsClient.executeOrder(activeProductId, order, signature);
      
      // Deduct Pay Asset, Add Receive Asset
      if (payAsset.isBase) {
        addTransaction({ type: 'Swap', amount: -numPayAmount, asset: 'USDC', network: network });
        updateTokenBalance(receiveAsset.symbol, receiveAmount);
      } else {
        updateTokenBalance(payAsset.symbol, -numPayAmount);
        addTransaction({ type: 'Swap', amount: receiveAmount, asset: 'USDC', network: network });
      }

      alert(`Successfully swapped ${numPayAmount} ${payAsset.symbol} for ${receiveAmount.toFixed(4)} ${receiveAsset.symbol}!`);
      setPayAmount('');
      handleAcceptUpdatedRate();
    } catch (err) {
      console.error(err);
      alert("Swap failed.");
    } finally {
      setIsSwapping(false);
    }
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
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[150px] -z-10 mix-blend-screen pointer-events-none" />

        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-extrabold mb-2">{t('swapTitle')}</h1>
            <p className="text-gray-400">{t('swapSubtitle')} over Nado DEX</p>
          </div>

          <div className="glass-panel p-6 rounded-3xl shadow-2xl border-t-primary/20 border-t relative">
            
            <div className="flex justify-between items-center mb-6">
              <span className="font-bold text-lg">{t('swapTitle')}</span>
              
              <div className="flex items-center gap-2">
                <span className={`text-xs font-mono px-2.5 py-1 rounded-full border flex items-center gap-1.5 font-bold ${
                  isPriceExpired ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-primary/10 border-primary/30 text-primary'
                }`}>
                  <Clock size={12} />
                  {isPriceExpired ? '00:00' : formatTimer(timeLeft)}
                </span>

                <div className="relative">
                  <button onClick={() => setShowSettings(!showSettings)} className={`text-gray-400 hover:text-white transition-colors ${showSettings ? 'text-primary' : ''}`} title="Settings">
                    <Settings size={18} />
                  </button>
                  {showSettings && (
                    <div className="absolute right-0 top-8 w-48 bg-gray-900 border border-white/10 rounded-xl p-3 z-50 shadow-2xl">
                      <div className="text-xs text-gray-400 mb-2 font-bold uppercase tracking-wider">Slippage Tolerance</div>
                      <div className="flex gap-2">
                        {[0.1, 0.5, 1.0].map(s => (
                          <button key={s} onClick={() => { setSelectedSlippage(s); setShowSettings(false); }} className={`flex-1 py-1.5 rounded-lg text-xs font-bold ${selectedSlippage === s ? 'bg-primary text-background' : 'bg-white/5 hover:bg-white/10'}`}>
                            {s}%
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

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
                <span>Balance: {formatCurrency(isConnected && payAsset.isBase ? balance : 0)}</span>
              </div>
              <div className="flex justify-between items-center">
                <input 
                  type="number" 
                  placeholder="0.0" 
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="bg-transparent text-3xl font-bold outline-none w-full" 
                />
                
                <div className="relative group">
                  <button className="flex items-center gap-2 glass-panel px-3 py-1.5 rounded-full whitespace-nowrap hover:bg-white/10">
                    <div className={`w-5 h-5 rounded-full ${payAsset.color} shadow-lg`} />
                    <span className="font-bold">{payAsset.symbol}</span>
                    <ChevronDown size={14} className="text-gray-400" />
                  </button>
                  <div className="absolute right-0 top-full mt-2 w-32 bg-gray-900 border border-white/10 rounded-xl overflow-hidden shadow-2xl opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity z-50">
                    {ASSETS.filter(a => a.symbol !== payAsset.symbol && (receiveAsset.isBase ? !a.isBase : a.isBase)).map(a => (
                      <button key={a.symbol} onClick={() => setPayAsset(a)} className="w-full flex items-center gap-2 px-4 py-2 hover:bg-white/10">
                        <div className={`w-4 h-4 rounded-full ${a.color}`} />
                        <span className="font-bold text-sm">{a.symbol}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Arrow Divider */}
            <div className="flex justify-center -my-3 relative z-10">
              <button onClick={handleSwapAssets} className="w-10 h-10 rounded-xl bg-background border border-white/10 flex items-center justify-center text-gray-400 hover:text-primary hover:border-primary/50 transition-colors shadow-xl group">
                <ArrowDown size={20} className="group-hover:rotate-180 transition-transform duration-300" />
              </button>
            </div>

            {/* Receive Section */}
            <div className="bg-black/40 border border-white/5 rounded-2xl p-4 mb-6">
              <div className="text-sm text-gray-400 mb-2 font-medium">{t('youReceive')}</div>
              <div className="flex justify-between items-center">
                <input 
                  type="number" 
                  placeholder="0.0" 
                  value={receiveAmount > 0 ? receiveAmount.toFixed(4) : ''}
                  readOnly
                  className="bg-transparent text-3xl font-bold outline-none w-full text-white/50" 
                />
                
                <div className="relative group">
                  <button className="flex items-center gap-2 glass-panel px-3 py-1.5 rounded-full whitespace-nowrap hover:bg-white/10">
                    <div className={`w-5 h-5 rounded-full ${receiveAsset.color} shadow-lg`} />
                    <span className="font-bold">{receiveAsset.symbol}</span>
                    <ChevronDown size={14} className="text-gray-400" />
                  </button>
                  <div className="absolute right-0 top-full mt-2 w-32 bg-gray-900 border border-white/10 rounded-xl overflow-hidden shadow-2xl opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity z-50">
                    {ASSETS.filter(a => a.symbol !== receiveAsset.symbol && (payAsset.isBase ? !a.isBase : a.isBase)).map(a => (
                      <button key={a.symbol} onClick={() => setReceiveAsset(a)} className="w-full flex items-center gap-2 px-4 py-2 hover:bg-white/10">
                        <div className={`w-4 h-4 rounded-full ${a.color}`} />
                        <span className="font-bold text-sm">{a.symbol}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Swap Details */}
            {numPayAmount > 0 && (
              <div className="mb-6 p-4 bg-white/5 rounded-xl text-sm space-y-2 border border-white/5">
                <div className="flex justify-between text-gray-400">
                  <span>Exchange Rate</span>
                  <span className="text-white">1 {payAsset.symbol} ≈ {((isBuyingAsset ? 1 / basePrice : basePrice)).toFixed(4)} {receiveAsset.symbol}</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Price Impact</span>
                  <span className={`font-bold ${priceImpact > selectedSlippage ? 'text-red-400' : 'text-green-400'}`}>{priceImpact.toFixed(2)}%</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Max Slippage</span>
                  <span className="text-white">{selectedSlippage}%</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Network Fee</span>
                  <span className="text-green-400 font-bold flex items-center gap-1"><Zap size={12}/> Free via Nado</span>
                </div>
              </div>
            )}

            <button 
              onClick={handleSwap}
              disabled={(!isConnected && false) || isSwapping}
              className={`w-full font-bold py-4 rounded-2xl transition-all duration-300 shadow-lg text-lg flex items-center justify-center gap-2 ${
                isPriceExpired
                  ? 'bg-yellow-500 text-background hover:bg-yellow-400 shadow-[0_0_20px_rgba(234,179,8,0.4)] cursor-pointer'
                  : !isConnected 
                    ? 'bg-primary/20 text-primary hover:bg-primary/30' 
                    : numPayAmount <= 0 
                      ? 'bg-white/5 text-gray-500 cursor-not-allowed'
                      : priceImpact > selectedSlippage
                        ? 'bg-red-500/20 text-red-500 cursor-not-allowed'
                        : 'bg-primary text-background hover:bg-primary/80 shadow-[0_0_20px_rgba(0,240,255,0.3)]'
              }`}
            >
              {isSwapping ? (
                <>
                  <RefreshCw size={18} className="animate-spin" />
                  Executing on Nado...
                </>
              ) : isPriceExpired ? (
                <>
                  <RefreshCw size={18} />
                  Accept Updated Rate
                </>
              ) : !isConnected ? (
                t('connect')
              ) : numPayAmount <= 0 ? (
                'Enter an amount'
              ) : priceImpact > selectedSlippage ? (
                'Price Impact Too High'
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
