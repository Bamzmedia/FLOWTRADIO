"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Wallet, 
  User, 
  LogOut, 
  Settings, 
  Menu, 
  X, 
  Copy, 
  Check, 
  ExternalLink, 
  AlertTriangle,
  LayoutDashboard,
  TrendingUp,
  BarChart2,
  Coins,
  Trophy
} from 'lucide-react';
import { useLocalization } from '@/components/LocalizationContext';
import { useWallet, Network } from '@/components/WalletContext';
import SettingsModal from './SettingsModal';

export default function Navbar() {
  const { t } = useLocalization();
  const {
    isConnected,
    address,
    displayAddress,
    network,
    isWrongNetwork,
    connect,
    disconnect,
    setNetwork,
    switchToInk,
  } = useWallet();
  
  const [mounted, setMounted] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const hasInjected = typeof window !== 'undefined' && Boolean((window as any).ethereum);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleConnect = async (providerType?: string) => {
    setShowWalletModal(false);
    await connect(providerType);
  };

  const copyAddress = () => {
    if (address && typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <>
      <nav className="glass-panel sticky top-0 z-40 flex items-center justify-between px-6 py-4 border-b-0">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-primary to-secondary flex items-center justify-center shadow-lg shadow-primary/20">
              <span className="font-bold text-white text-lg leading-none">N</span>
            </div>
            <span className="text-xl font-bold tracking-wider">NEOTRADIO</span>
          </Link>
          
          <div className="hidden lg:flex gap-6 text-sm text-gray-400 font-medium">
            <Link href="/" className="hover:text-primary transition-colors flex items-center gap-1.5">
              <LayoutDashboard size={15} />
              <span>{t('dashboard')}</span>
            </Link>
            <Link href="/trade" className="hover:text-primary transition-colors flex items-center gap-1.5">
              <TrendingUp size={15} />
              <span>{t('trade')}</span>
            </Link>
            <Link href="/markets" className="hover:text-primary transition-colors flex items-center gap-1.5">
              <BarChart2 size={15} />
              <span>{t('markets')}</span>
            </Link>
            <Link href="/earn" className="hover:text-primary transition-colors flex items-center gap-1.5">
              <Coins size={15} />
              <span>{t('earn')}</span>
            </Link>
            <Link href="/leaderboard" className="hover:text-primary transition-colors flex items-center gap-1.5">
              <Trophy size={15} />
              <span>Leaderboard</span>
            </Link>
          </div>
        </div>

        <div className="flex items-center gap-3 relative">
          {/* Settings Button */}
          <button 
            onClick={() => setShowSettings(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full glass-panel hover:bg-white/10 transition-all text-sm group"
          >
            <Settings size={16} className="text-gray-400 group-hover:text-white transition-colors" />
          </button>
          
          {showSettings && (
            <SettingsModal onClose={() => setShowSettings(false)} />
          )}

          {!mounted ? (
            <button 
              disabled
              className="flex items-center gap-2 bg-primary/30 text-background/80 px-4 sm:px-5 py-2 rounded-full font-bold transition-all cursor-wait opacity-80"
            >
              <Wallet size={18} />
              <span className="text-xs sm:text-sm font-bold">Connect Wallet</span>
            </button>
          ) : isConnected ? (
            isWrongNetwork ? (
              <button 
                onClick={switchToInk}
                className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/40 hover:border-amber-500/70 hover:bg-amber-500/20 text-amber-300 px-4 sm:px-5 py-2 rounded-full transition-all shadow-sm group font-bold"
              >
                <AlertTriangle size={18} className="text-amber-400 animate-pulse" />
                <span className="text-xs sm:text-sm">Switch to Nado Network</span>
              </button>
            ) : (
              <div className="relative">
                <button 
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  className="flex items-center gap-2 bg-black/40 border border-primary/30 hover:border-primary/60 text-white pl-1.5 pr-4 py-1.5 rounded-full transition-all"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-primary to-secondary flex items-center justify-center shadow-md">
                    <Wallet size={14} className="text-black" />
                  </div>
                  <div className="flex flex-col items-start ml-1">
                    <span className="text-sm font-bold font-mono leading-none tracking-wide text-white">
                      {displayAddress || (address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '')}
                    </span>
                    <span className="text-[11px] text-gray-400 leading-tight font-medium mt-0.5">
                      Balance: {balance.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} USDC
                    </span>
                  </div>
                </button>
                
                {showProfileMenu && (
                  <div className="absolute top-14 right-0 glass-panel p-2 rounded-2xl flex flex-col w-56 shadow-2xl z-50 border border-white/10">
                    <button
                      onClick={() => { copyAddress(); setShowProfileMenu(false); }}
                      className="flex items-center gap-3 px-3 py-2.5 hover:bg-white/10 rounded-xl transition-colors text-sm font-medium w-full text-left"
                    >
                      {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} className="text-gray-400" />}
                      <span>{copied ? 'Copied!' : 'Copy address'}</span>
                    </button>
                    
                    {address && (
                      <a
                        href={`https://explorer.inkonchain.com/address/${address}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 px-3 py-2.5 hover:bg-white/10 rounded-xl transition-colors text-sm font-medium w-full text-left"
                      >
                        <ExternalLink size={16} className="text-gray-400" />
                        <span>View explorer</span>
                      </a>
                    )}
                    
                    <div className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium w-full text-left cursor-default">
                      <div className="w-3 h-3 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] flex-shrink-0" />
                      <span>Nado Network</span>
                    </div>

                    <Link 
                      href="/wallet?tab=deposit" 
                      onClick={() => setShowProfileMenu(false)}
                      className="flex items-center gap-3 px-3 py-2.5 hover:bg-white/10 rounded-xl transition-colors text-sm font-medium w-full text-left"
                    >
                      <TrendingUp size={16} className="text-gray-400" />
                      <span>Deposit</span>
                    </Link>
                    
                    <Link 
                      href="/wallet?tab=withdraw" 
                      onClick={() => setShowProfileMenu(false)}
                      className="flex items-center gap-3 px-3 py-2.5 hover:bg-white/10 rounded-xl transition-colors text-sm font-medium w-full text-left"
                    >
                      <LogOut size={16} className="text-gray-400" />
                      <span>Withdraw</span>
                    </Link>

                    <hr className="border-white/10 my-1 mx-1" />
                    
                    <button 
                      onClick={() => { disconnect(); setShowProfileMenu(false); }}
                      className="flex items-center gap-3 px-3 py-2.5 hover:bg-red-500/20 text-red-400 rounded-xl transition-colors text-sm font-medium w-full text-left"
                    >
                      <LogOut size={16} />
                      <span>Disconnect</span>
                    </button>
                  </div>
                )}
              </div>
            )
          ) : (
            <button 
              onClick={() => setShowWalletModal(true)}
              className="flex items-center gap-2 bg-primary hover:bg-primary/80 text-background px-4 sm:px-5 py-2 rounded-full font-bold transition-all shadow-[0_0_15px_rgba(0,240,255,0.4)] cursor-pointer"
            >
              <Wallet size={18} />
              <span className="text-xs sm:text-sm font-bold">{t('connect') || 'Connect Wallet'}</span>
            </button>
          )}

          {/* Mobile Menu Toggle */}
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="lg:hidden p-2 text-gray-400 hover:text-white transition-colors"
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </nav>

      {/* Mobile Navigation Menu */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 top-[72px] bg-background/95 backdrop-blur-xl z-30 flex flex-col p-6 animate-in slide-in-from-top-4 duration-200 border-t border-white/5 justify-between pb-12 overflow-y-auto">
          <div className="flex flex-col gap-3 text-lg font-bold">
            <Link href="/" onClick={() => setIsMobileMenuOpen(false)} className="hover:text-primary transition-colors p-3 rounded-xl hover:bg-white/5 flex items-center gap-3">
              <LayoutDashboard size={20} className="text-primary" />
              <span>{t('dashboard')}</span>
            </Link>
            <Link href="/trade" onClick={() => setIsMobileMenuOpen(false)} className="hover:text-primary transition-colors p-3 rounded-xl hover:bg-white/5 flex items-center gap-3">
              <TrendingUp size={20} className="text-primary" />
              <span>{t('trade')}</span>
            </Link>
            <Link href="/markets" onClick={() => setIsMobileMenuOpen(false)} className="hover:text-primary transition-colors p-3 rounded-xl hover:bg-white/5 flex items-center gap-3">
              <BarChart2 size={20} className="text-primary" />
              <span>{t('markets')}</span>
            </Link>
            <Link href="/earn" onClick={() => setIsMobileMenuOpen(false)} className="hover:text-primary transition-colors p-3 rounded-xl hover:bg-white/5 flex items-center gap-3">
              <Coins size={20} className="text-primary" />
              <span>{t('earn')}</span>
            </Link>
            <Link href="/leaderboard" onClick={() => setIsMobileMenuOpen(false)} className="hover:text-primary transition-colors p-3 rounded-xl hover:bg-white/5 flex items-center gap-3">
              <Trophy size={20} className="text-primary" />
              <span>Leaderboard</span>
            </Link>
          </div>

          {/* Mobile Wallet & Action Section */}
          <div className="pt-6 border-t border-white/10 flex flex-col gap-3 mt-6">
            {isConnected ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between p-3 bg-black/40 rounded-xl border border-white/10">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-green-400 to-blue-500 flex items-center justify-center">
                      <User size={14} className="text-black" />
                    </div>
                    <span className="font-mono text-sm">{displayAddress || address}</span>
                  </div>
                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">{network}</span>
                </div>
                <button
                  onClick={() => { disconnect(); setIsMobileMenuOpen(false); }}
                  className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"
                >
                  <LogOut size={16} /> Disconnect Wallet
                </button>
              </div>
            ) : (
              <button
                onClick={() => { setShowWalletModal(true); setIsMobileMenuOpen(false); }}
                className="w-full py-3 bg-primary hover:bg-primary/90 text-background rounded-xl font-bold flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(0,240,255,0.4)] transition-all"
              >
                <Wallet size={18} />
                <span>Connect Wallet</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Wallet Connection Modal */}
      {showWalletModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowWalletModal(false)}>
          <div className="glass-panel p-8 rounded-3xl w-full max-w-md shadow-2xl border-t border-t-primary/20" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-2xl font-bold mb-2">Connect Wallet</h2>
            <p className="text-gray-400 text-sm mb-6">Select your preferred network and wallet provider.</p>
            
            <div className="mb-6">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">1. Target Network</label>
              <div className="grid grid-cols-1 gap-3">
                {['Ink'].map((n) => (
                  <button 
                    key={n}
                    onClick={() => setNetwork(n as Network)}
                    className={`py-2 px-3 rounded-xl text-sm font-bold border transition-all flex items-center justify-between ${network === n ? 'bg-primary/10 border-primary text-primary' : 'bg-black/40 border-white/5 text-gray-300 hover:border-white/20'}`}
                  >
                    <span>{n} Mainnet</span>
                    <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">Chain ID 57073</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">2. Select Provider</label>
              <div className="space-y-3">
                <button
                  onClick={() => handleConnect('metamask')}
                  className="w-full flex items-center justify-between p-4 bg-black/40 border border-white/5 rounded-xl hover:bg-white/5 hover:border-primary/50 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white font-bold">M</div>
                    <span className="font-bold group-hover:text-primary transition-colors">MetaMask / Injected</span>
                  </div>
                  {hasInjected && (
                    <span className="text-xs text-green-400 bg-green-400/10 px-2 py-1 rounded-full">Detected</span>
                  )}
                </button>
                <button
                  onClick={() => handleConnect('phantom')}
                  className="w-full flex items-center justify-between p-4 bg-black/40 border border-white/5 rounded-xl hover:bg-white/5 hover:border-secondary/50 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center text-white font-bold">P</div>
                    <span className="font-bold group-hover:text-secondary transition-colors">Phantom</span>
                  </div>
                </button>
                <button
                  onClick={() => handleConnect('walletconnect')}
                  className="w-full flex items-center justify-between p-4 bg-black/40 border border-white/5 rounded-xl hover:bg-white/5 hover:border-blue-500/50 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold">W</div>
                    <span className="font-bold group-hover:text-blue-500 transition-colors">WalletConnect / AppKit</span>
                  </div>
                </button>
              </div>
            </div>
            
            <button 
              onClick={() => setShowWalletModal(false)}
              className="w-full mt-6 py-3 text-sm font-bold text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}
