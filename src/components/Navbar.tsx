"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Wallet, User, LogOut, Settings, Menu, X, Copy, Check, ExternalLink, AlertTriangle } from 'lucide-react';
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
            <Link href="/" className="hover:text-primary transition-colors">{t('dashboard')}</Link>
            <Link href="/trade" className="hover:text-primary transition-colors">{t('trade')}</Link>
            <Link href="/markets" className="hover:text-primary transition-colors">{t('markets')}</Link>
            <Link href="/earn" className="hover:text-primary transition-colors">{t('earn')}</Link>
            <Link href="/leaderboard" className="hover:text-primary transition-colors">Leaderboard</Link>
          </div>
        </div>

        <div className="flex items-center gap-3 relative">
          {/* Wrong Network Warning Banner in Navbar */}
          {isConnected && isWrongNetwork && (
            <button
              onClick={switchToInk}
              className="flex items-center gap-1.5 bg-amber-500/15 border border-amber-500/40 hover:bg-amber-500/25 text-amber-300 px-3 py-1.5 rounded-full text-xs font-bold transition-all shadow-sm group"
              title="Click to switch your wallet network to Ink (Chain ID: 57073)"
            >
              <AlertTriangle size={14} className="text-amber-400 animate-pulse" />
              <span>Switch to Ink</span>
            </button>
          )}

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
              className="flex items-center gap-2 bg-primary/30 text-background/80 px-5 py-2 rounded-full font-bold transition-all cursor-wait opacity-80"
            >
              <Wallet size={18} />
              <span className="hidden sm:inline">Connect Wallet</span>
            </button>
          ) : isConnected ? (
            <div className="relative">
              <button 
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className={`flex items-center gap-2 bg-black/40 border ${isWrongNetwork ? 'border-amber-500/40 hover:border-amber-500/70' : 'border-primary/30 hover:border-primary/60'} text-white px-4 py-1.5 rounded-full font-bold transition-all`}
              >
                <div className={`w-5 h-5 rounded-full ${isWrongNetwork ? 'bg-gradient-to-tr from-amber-400 to-red-500' : 'bg-gradient-to-tr from-green-400 to-blue-500'}`} />
                <span className="text-sm font-mono">{displayAddress || (address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '')}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ml-1 ${isWrongNetwork ? 'bg-amber-500/20 text-amber-300 font-bold' : 'bg-primary/10 text-primary'}`}>
                  {isWrongNetwork ? 'Wrong Network' : network}
                </span>
              </button>
              
              {showProfileMenu && (
                <div className="absolute top-12 right-0 glass-panel p-3 rounded-2xl flex flex-col w-60 shadow-2xl z-50 border border-white/10">
                  {/* Address & Quick Copy */}
                  <div className="px-3 py-2 bg-black/30 rounded-xl mb-2 flex items-center justify-between">
                    <span className="text-xs font-mono text-gray-300 truncate max-w-[150px]">{displayAddress || address}</span>
                    <button
                      onClick={copyAddress}
                      className="text-gray-400 hover:text-primary transition-colors p-1 rounded hover:bg-white/10"
                      title="Copy full address"
                    >
                      {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                    </button>
                  </div>

                  {address && (
                    <a
                      href={`https://explorer.inkonchain.com/address/${address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between px-3 py-2 hover:bg-white/10 rounded-xl transition-colors text-xs text-gray-400 hover:text-white mb-1"
                    >
                      <span>View on Ink Explorer</span>
                      <ExternalLink size={12} />
                    </a>
                  )}

                  {isWrongNetwork && (
                    <button
                      onClick={() => { switchToInk(); setShowProfileMenu(false); }}
                      className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 rounded-xl transition-colors text-xs font-bold w-full text-left mb-1"
                    >
                      <AlertTriangle size={14} /> Switch to Ink Network
                    </button>
                  )}

                  <hr className="border-white/10 my-1 mx-1" />

                  <Link 
                    href="/profile" 
                    onClick={() => setShowProfileMenu(false)}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-white/10 rounded-xl transition-colors text-sm font-medium"
                  >
                    <User size={16} /> My Profile
                  </Link>
                  <Link 
                    href="/wallet" 
                    onClick={() => setShowProfileMenu(false)}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-white/10 rounded-xl transition-colors text-sm font-medium"
                  >
                    <Wallet size={16} /> Wallet Dashboard
                  </Link>
                  <hr className="border-white/10 my-1 mx-1" />
                  <button 
                    onClick={() => { disconnect(); setShowProfileMenu(false); }}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-red-500/20 text-red-400 rounded-xl transition-colors text-sm font-medium w-full text-left"
                  >
                    <LogOut size={16} /> Disconnect
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button 
              onClick={() => setShowWalletModal(true)}
              className="flex items-center gap-2 bg-primary hover:bg-primary/80 text-background px-5 py-2 rounded-full font-bold transition-all shadow-[0_0_15px_rgba(0,240,255,0.4)]"
            >
              <Wallet size={18} />
              <span className="hidden sm:inline">{t('connect')}</span>
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
        <div className="lg:hidden fixed inset-0 top-[72px] bg-background/95 backdrop-blur-xl z-30 flex flex-col p-6 animate-in slide-in-from-top-4 duration-200 border-t border-white/5">
          <div className="flex flex-col gap-6 text-lg font-bold">
            <Link href="/" onClick={() => setIsMobileMenuOpen(false)} className="hover:text-primary transition-colors p-2 rounded-xl hover:bg-white/5">{t('dashboard')}</Link>
            <Link href="/trade" onClick={() => setIsMobileMenuOpen(false)} className="hover:text-primary transition-colors p-2 rounded-xl hover:bg-white/5">{t('trade')}</Link>
            <Link href="/markets" onClick={() => setIsMobileMenuOpen(false)} className="hover:text-primary transition-colors p-2 rounded-xl hover:bg-white/5">{t('markets')}</Link>
            <Link href="/earn" onClick={() => setIsMobileMenuOpen(false)} className="hover:text-primary transition-colors p-2 rounded-xl hover:bg-white/5">{t('earn')}</Link>
            <Link href="/leaderboard" onClick={() => setIsMobileMenuOpen(false)} className="hover:text-primary transition-colors p-2 rounded-xl hover:bg-white/5">Leaderboard</Link>
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
