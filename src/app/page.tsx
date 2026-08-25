"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { BarChart3, TrendingUp, ChevronDown, Activity, List, PieChart, Info, Zap, MapPin, TrendingDown, Settings } from 'lucide-react';
import { useLocalization } from '@/components/LocalizationContext';
import { useWallet } from '@/components/WalletContext';
import Navbar from '@/components/Navbar';

export default function NadoTradingHub() {
  const [activeTab, setActiveTab] = useState<'positions' | 'orders' | 'activity'>('positions');
  const { t, formatCurrency, getRegionalTrending, region, mode } = useLocalization();
  const { isConnected, balance } = useWallet();

  // Trading Widget State
  const [tradeDirection, setTradeDirection] = useState<'long' | 'short'>('long');
  const [orderType, setOrderType] = useState<'market' | 'limit' | 'stop'>('market');
  const [leverage, setLeverage] = useState(10);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [oneClick, setOneClick] = useState(false);
  const [payAmount, setPayAmount] = useState<string>('');

  // Dynamic Greeting State
  const [greeting, setGreeting] = useState('morning');

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('morning');
    else if (hour < 18) setGreeting('afternoon');
    else setGreeting('evening');
  }, []);

  // Mock Calculations
  const assetPrice = 2.45; // NADO price
  const numPayAmount = parseFloat(payAmount) || 0;
  const positionSizeUsd = numPayAmount * leverage;
  const positionSizeAsset = positionSizeUsd / assetPrice;

  const { addTransaction } = useWallet();

  const handleExecute = () => {
    if (!isConnected) {
      alert("Please connect wallet first!");
      return;
    }
    if (numPayAmount <= 0) {
      alert("Enter a valid amount!");
      return;
    }
    if (numPayAmount > balance) {
      alert("Insufficient USDC balance!");
      return;
    }

    addTransaction({
      type: 'Trade',
      amount: -numPayAmount, // Deducting cost of position
      asset: 'USDC',
      network: 'Arbitrum'
    });

    alert(`Successfully executed ${leverage}x ${tradeDirection.toUpperCase()} order for ${positionSizeAsset.toFixed(2)} NADO!`);
    setPayAmount('');
  };

  return (
    <div className="min-h-screen text-foreground font-sans flex flex-col pb-20 relative">
      <Navbar />

      <main className="flex-1 flex flex-col p-6 md:p-8 relative max-w-7xl mx-auto w-full">
        
        {/* Background glow effects */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[150px] -z-10 mix-blend-screen pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-secondary/20 rounded-full blur-[150px] -z-10 mix-blend-screen pointer-events-none" />

        {/* Personalized Greeting */}
        <div className="mb-8">
          <div className="text-xl font-bold tracking-tight">
            {greeting}, <span className="text-primary">Trader</span>!
          </div>
          <div className="text-gray-400 flex items-center gap-2">
            <MapPin size={16} /> 
            {mode === 'global' ? t('trending_global') : `${t('trending_in')} ${region}`}
          </div>
        </div>
        
        {/* Regional Trending Widget */}
        <div className="mb-8 flex gap-4 mt-4 overflow-x-auto pb-2 scrollbar-hide">
            {getRegionalTrending().map((market) => (
              <div key={market.asset} className="glass-panel px-4 py-2 rounded-xl flex items-center gap-3 min-w-[140px]">
                <div className="font-bold text-sm">{market.asset}</div>
                <div className={`text-xs font-bold flex items-center gap-0.5 ${market.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {market.change >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                  {Math.abs(market.change)}%
                </div>
              </div>
            ))}
          </div>
          
        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="glass-panel p-6 rounded-3xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-2xl -mr-10 -mt-10 group-hover:bg-primary/20 transition-all" />
            <h3 className="text-gray-400 text-sm font-medium mb-1 flex items-center gap-2">
              <PieChart size={16} /> {t('portfolio')}
            </h3>
            <div className="text-4xl font-bold tracking-tight mb-2">{formatCurrency(isConnected ? balance : 0)}</div>
            <div className="text-sm text-green-400 flex items-center gap-1 font-medium">
              <TrendingUp size={14} /> +{formatCurrency(isConnected ? balance * 0.05 : 0)} (5.00%)
            </div>
          </div>

          <div className="glass-panel p-6 rounded-3xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-secondary/10 rounded-full blur-2xl -mr-10 -mt-10 group-hover:bg-secondary/20 transition-all" />
            <h3 className="text-gray-400 text-sm font-medium mb-1 flex items-center gap-2">
              <Activity size={16} /> {t('pnl')}
            </h3>
            <div className="text-4xl font-bold tracking-tight mb-2">{formatCurrency(isConnected ? balance * 0.05 : 0)}</div>
          </div>

          <div className="glass-panel p-6 rounded-3xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-accent/10 rounded-full blur-2xl -mr-10 -mt-10 group-hover:bg-accent/20 transition-all" />
            <h3 className="text-gray-400 text-sm font-medium mb-1 flex items-center gap-2">
              <BarChart3 size={16} /> {t('volume')}
            </h3>
            <div className="text-4xl font-bold tracking-tight mb-2">{formatCurrency(0)}</div>
          </div>
        </div>

        {/* Main Grid: Trading Widget + Tables */}
        <div className="grid lg:grid-cols-3 gap-8">
          
          {/* Advanced Trading Widget (Left Sidebar) */}
          <div className="lg:col-span-1 h-fit glass-panel rounded-3xl p-6 shadow-2xl relative border-t-primary/20 border-t">
            
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">Trade NADO-PERP</h2>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setOneClick(!oneClick)}
                  className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full transition-colors ${oneClick ? 'bg-yellow-500/20 text-yellow-500' : 'bg-white/5 text-gray-500'}`}
                >
                  <Zap size={12} className={oneClick ? "fill-yellow-500" : ""} />
                  1-Click
                </button>
                <button className="text-gray-400 hover:text-white transition-colors">
                  <Settings size={20} />
                </button>
              </div>
            </div>

            {/* Long / Short Toggle */}
            <div className="flex bg-black/40 rounded-xl p-1 mb-4">
              <button 
                onClick={() => setTradeDirection('long')}
                className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${tradeDirection === 'long' ? 'bg-green-500 text-background shadow-lg shadow-green-500/20' : 'text-gray-400 hover:text-gray-200'}`}
              >
                Long
              </button>
              <button 
                onClick={() => setTradeDirection('short')}
                className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${tradeDirection === 'short' ? 'bg-red-500 text-background shadow-lg shadow-red-500/20' : 'text-gray-400 hover:text-gray-200'}`}
              >
                Short
              </button>
            </div>

            {/* Order Types Tabs */}
            <div className="flex gap-4 text-sm mb-6 border-b border-white/10 pb-2">
              <button onClick={() => setOrderType('market')} className={`font-semibold ${orderType === 'market' ? 'text-primary' : 'text-gray-500 hover:text-gray-300'}`}>Market</button>
              <button onClick={() => setOrderType('limit')} className={`font-semibold ${orderType === 'limit' ? 'text-primary' : 'text-gray-500 hover:text-gray-300'}`}>Limit</button>
              <button onClick={() => setOrderType('stop')} className={`font-semibold ${orderType === 'stop' ? 'text-primary' : 'text-gray-500 hover:text-gray-300'}`}>Stop</button>
            </div>

            <div className="space-y-4">
              
              {/* Limit/Stop Price Inputs */}
              {(orderType === 'limit' || orderType === 'stop') && (
                <div className="bg-black/40 border border-white/5 rounded-2xl p-4 flex justify-between items-center focus-within:border-primary/50 transition-colors">
                  <span className="text-gray-400 text-sm font-medium">Price</span>
                  <div className="flex items-center gap-2">
                    <input type="text" placeholder="2.45" className="bg-transparent text-right font-bold outline-none w-24" />
                    <span className="text-gray-500 text-sm">USD</span>
                  </div>
                </div>
              )}

              {/* Pay Amount Input */}
              <div className="bg-black/40 border border-white/5 rounded-2xl p-4 focus-within:border-primary/50 transition-colors">
                <div className="text-sm text-gray-400 mb-2 flex justify-between font-medium">
                  <span>Pay (Margin)</span>
                  <span>Bal: {formatCurrency(isConnected ? balance : 0)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <input 
                    type="number" 
                    placeholder="0.0" 
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    className="bg-transparent text-3xl font-bold outline-none w-1/2" 
                  />
                  <div className="flex items-center gap-2 glass-panel px-3 py-1.5 rounded-full">
                    <div className="w-5 h-5 rounded-full bg-blue-500 shadow-lg shadow-blue-500/20" />
                    <span className="font-semibold">USDC</span>
                  </div>
                </div>
              </div>

              {/* Leverage Slider */}
              <div className="pt-2">
                <div className="flex justify-between items-center text-sm mb-2">
                  <span className="text-gray-400 font-medium">Leverage</span>
                  <span className="font-bold text-primary">{leverage}x</span>
                </div>
                <input 
                  type="range" 
                  min="1" 
                  max="100" 
                  value={leverage}
                  onChange={(e) => setLeverage(parseInt(e.target.value))}
                  className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary" 
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>1x</span>
                  <span>50x</span>
                  <span>100x</span>
                </div>
              </div>

              {/* Position Size Calculator Display */}
              <div className="bg-primary/5 border border-primary/10 rounded-xl p-3 flex justify-between items-center text-sm">
                <span className="text-gray-400">Position Size</span>
                <div className="text-right">
                  <div className="font-bold text-white">{positionSizeAsset.toFixed(2)} NADO</div>
                  <div className="text-gray-500 text-xs">≈ {formatCurrency(positionSizeUsd)}</div>
                </div>
              </div>

              {/* Advanced Settings Toggle */}
              <div className="pt-2">
                <button 
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors"
                >
                  <ChevronDown size={14} className={`transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
                  Advanced Settings (TP/SL)
                </button>
                
                {showAdvanced && (
                  <div className="mt-4 space-y-3 p-4 bg-black/20 rounded-xl border border-white/5">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-400">Take Profit</span>
                      <input type="text" placeholder="None" className="bg-black/40 border border-white/5 rounded px-2 py-1 text-sm w-24 text-right outline-none focus:border-primary/50" />
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-400">Stop Loss</span>
                      <input type="text" placeholder="None" className="bg-black/40 border border-white/5 rounded px-2 py-1 text-sm w-24 text-right outline-none focus:border-primary/50" />
                    </div>
                  </div>
                )}
              </div>

            </div>

            {/* Action Button */}
            <button 
              onClick={handleExecute}
              className={`w-full mt-6 font-bold py-4 rounded-2xl transition-all duration-300 text-background shadow-lg ${tradeDirection === 'long' ? 'bg-green-500 hover:bg-green-400 shadow-green-500/20' : 'bg-red-500 hover:bg-red-400 shadow-red-500/20'}`}
            >
              {isConnected ? `Execute ${tradeDirection === 'long' ? 'Long' : 'Short'}` : `${t('connect')} to ${tradeDirection === 'long' ? 'Long' : 'Short'} NADO`}
            </button>
            
            {/* Info Footer */}
            <div className="flex items-center justify-center gap-1 mt-4 text-xs text-gray-500">
              <Info size={12} />
              <span>Available Liquidity: $14.2M</span>
            </div>
          </div>

          {/* Tabbed Data Section (Main Area) */}
          <div className="lg:col-span-2 glass-panel rounded-3xl overflow-hidden flex flex-col border-t-secondary/20 border-t">
            
            {/* Tabs */}
            <div className="flex border-b border-white/10 bg-black/20">
              <button 
                onClick={() => setActiveTab('positions')}
                className={`flex-1 py-4 text-sm font-semibold transition-all ${activeTab === 'positions' ? 'text-primary border-b-2 border-primary bg-primary/5' : 'text-gray-400 hover:text-gray-200'}`}
              >
                {t('positions')}
              </button>
              <button 
                onClick={() => setActiveTab('orders')}
                className={`flex-1 py-4 text-sm font-semibold transition-all ${activeTab === 'orders' ? 'text-primary border-b-2 border-primary bg-primary/5' : 'text-gray-400 hover:text-gray-200'}`}
              >
                {t('orders')} (0)
              </button>
              <button 
                onClick={() => setActiveTab('activity')}
                className={`flex-1 py-4 text-sm font-semibold transition-all ${activeTab === 'activity' ? 'text-primary border-b-2 border-primary bg-primary/5' : 'text-gray-400 hover:text-gray-200'}`}
              >
                {t('activity')}
              </button>
            </div>

            {/* Tab Content Area */}
            <div className="flex-1 p-8 flex flex-col items-center justify-center min-h-[400px]">
              
              {activeTab === 'positions' && (
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full glass-panel flex items-center justify-center mx-auto mb-4 text-gray-500">
                    <PieChart size={24} />
                  </div>
                  <h3 className="text-lg font-bold mb-2">{t('noPositions')}</h3>
                  <p className="text-gray-400 text-sm max-w-sm mx-auto mb-6">
                    {t('noPositionsDesc')}
                  </p>
                </div>
              )}

              {activeTab === 'orders' && (
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full glass-panel flex items-center justify-center mx-auto mb-4 text-gray-500">
                    <List size={24} />
                  </div>
                  <h3 className="text-lg font-bold mb-2">0 Orders</h3>
                </div>
              )}

              {activeTab === 'activity' && (
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full glass-panel flex items-center justify-center mx-auto mb-4 text-gray-500">
                    <Activity size={24} />
                  </div>
                  <h3 className="text-lg font-bold mb-2">No Recent Activity</h3>
                </div>
              )}

            </div>
          </div>
          
        </div>
      </main>
    </div>
  );
}
