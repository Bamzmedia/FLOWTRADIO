"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { Globe, Wallet, ChevronDown, User, LogOut, Settings, Menu, X } from 'lucide-react';
import { useLocalization } from '@/components/LocalizationContext';
import { useWallet, Network } from '@/components/WalletContext';
import SettingsModal from './SettingsModal';

export default function Navbar() {
  const { t, language, setLanguage, currency, setCurrency, region, setRegion } = useLocalization();
  const { isConnected, address, network, connect, disconnect, setNetwork } = useWallet();
  
  const [showSettings, setShowSettings] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleConnect = (selectedNetwork: Network, isDemo: boolean = false) => {
    connect(selectedNetwork, isDemo);
    setShowWalletModal(false);
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

        <div className="flex items-center gap-4 relative">
          <button 
            onClick={() => setShowSettings(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full glass-panel hover:bg-white/10 transition-all text-sm group"
          >
            <Settings size={16} className="text-gray-400 group-hover:text-white transition-colors" />
          </button>
          
          {showSettings && (
            <SettingsModal onClose={() => setShowSettings(false)} />
          )}

          {isConnected ? (
            <div className="relative">
              <button 
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="flex items-center gap-2 bg-black/40 border border-primary/30 hover:border-primary/60 text-white px-4 py-1.5 rounded-full font-bold transition-all"
              >
                <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-green-400 to-blue-500" />
                <span className="text-sm">{address}</span>
                <span className="text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-full ml-1">{network}</span>
              </button>
              
              {showProfileMenu && (
                <div className="absolute top-12 right-0 glass-panel p-2 rounded-2xl flex flex-col w-48 shadow-2xl z-50">
                  <Link 
                    href="/profile" 
                    onClick={() => setShowProfileMenu(false)}
                    className="flex items-center gap-2 px-4 py-2 hover:bg-white/10 rounded-xl transition-colors text-sm font-medium"
                  >
                    <User size={16} /> My Profile
                  </Link>
                  <Link 
                    href="/wallet" 
                    onClick={() => setShowProfileMenu(false)}
                    className="flex items-center gap-2 px-4 py-2 hover:bg-white/10 rounded-xl transition-colors text-sm font-medium"
                  >
                    <Wallet size={16} /> Wallet Dashboard
                  </Link>
                  <hr className="border-white/10 my-1 mx-2" />
                  <button 
                    onClick={() => { disconnect(); setShowProfileMenu(false); }}
                    className="flex items-center gap-2 px-4 py-2 hover:bg-red-500/20 text-red-400 rounded-xl transition-colors text-sm font-medium w-full text-left"
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
          <div className="glass-panel p-8 rounded-3xl w-full max-w-md shadow-2xl border-t border-t-primary/20" onClick={e => e.stopPropagation()}>
            <h2 className="text-2xl font-bold mb-2">Connect Wallet</h2>
            <p className="text-gray-400 text-sm mb-6">Select your preferred network and wallet provider.</p>
            
            <div className="mb-6">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">1. Select Network</label>
              <div className="grid grid-cols-2 gap-3">
                {['Arbitrum', 'Ethereum', 'Solana', 'Polygon'].map((n) => (
                  <button 
                    key={n}
                    onClick={() => setNetwork(n as Network)}
                    className={`py-2 px-3 rounded-xl text-sm font-bold border transition-all ${network === n ? 'bg-primary/10 border-primary text-primary' : 'bg-black/40 border-white/5 text-gray-300 hover:border-white/20'}`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">2. Select Provider</label>
              <div className="space-y-3">
                <button onClick={() => handleConnect(network)} className="w-full flex items-center justify-between p-4 bg-black/40 border border-white/5 rounded-xl hover:bg-white/5 hover:border-primary/50 transition-all group">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white font-bold">M</div>
                    <span className="font-bold group-hover:text-primary transition-colors">MetaMask</span>
                  </div>
                  <span className="text-xs text-green-400 bg-green-400/10 px-2 py-1 rounded-full">Detected</span>
                </button>
                <button onClick={() => handleConnect(network)} className="w-full flex items-center justify-between p-4 bg-black/40 border border-white/5 rounded-xl hover:bg-white/5 hover:border-secondary/50 transition-all group">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center text-white font-bold">P</div>
                    <span className="font-bold group-hover:text-secondary transition-colors">Phantom</span>
                  </div>
                </button>
                <button onClick={() => handleConnect(network)} className="w-full flex items-center justify-between p-4 bg-black/40 border border-white/5 rounded-xl hover:bg-white/5 hover:border-blue-500/50 transition-all group">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold">W</div>
                    <span className="font-bold group-hover:text-blue-500 transition-colors">WalletConnect</span>
                  </div>
                </button>
                
                <div className="relative flex py-2 items-center">
                  <div className="flex-grow border-t border-white/10"></div>
                  <span className="flex-shrink mx-4 text-gray-500 text-xs font-semibold">OR</span>
                  <div className="flex-grow border-t border-white/10"></div>
                </div>

                <button 
                  onClick={() => handleConnect(network, true)} 
                  className="w-full flex items-center justify-between p-4 bg-primary/10 border border-primary/20 rounded-xl hover:bg-primary/20 hover:border-primary/50 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-background font-bold">D</div>
                    <span className="font-bold text-primary group-hover:text-primary transition-colors">Simulated Demo Wallet</span>
                  </div>
                  <span className="text-xs text-primary bg-primary/20 px-2 py-1 rounded-full">Instant</span>
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
