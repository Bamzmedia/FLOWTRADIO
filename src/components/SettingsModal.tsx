"use client";

import React, { useState } from 'react';
import { useLocalization } from './LocalizationContext';
import { Settings, X, Globe, Sliders, Bell, Moon, Sun, Monitor, AlertTriangle } from 'lucide-react';

interface SettingsModalProps {
  onClose: () => void;
}

export default function SettingsModal({ onClose }: SettingsModalProps) {
  const { 
    language, setLanguage, currency, setCurrency, region, setRegion, 
    theme, setTheme, mode, setMode, slippage, setSlippage, oneClickTrading, setOneClickTrading,
    notifications, setNotifications 
  } = useLocalization();

  const [activeTab, setActiveTab] = useState<'general' | 'trading' | 'notifications'>('general');

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="glass-panel rounded-3xl w-full max-w-3xl h-[600px] flex overflow-hidden shadow-2xl border-t border-t-primary/20" onClick={e => e.stopPropagation()}>
        
        {/* Sidebar Tabs */}
        <div className="w-64 bg-black/40 border-r border-white/5 p-6 flex flex-col gap-2">
          <div className="flex items-center gap-2 mb-8 text-xl font-bold">
            <Settings size={24} className="text-primary" /> Settings
          </div>
          
          <button 
            onClick={() => setActiveTab('general')}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium ${activeTab === 'general' ? 'bg-primary/20 text-primary' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
          >
            <Globe size={18} /> General
          </button>
          
          <button 
            onClick={() => setActiveTab('trading')}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium ${activeTab === 'trading' ? 'bg-primary/20 text-primary' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
          >
            <Sliders size={18} /> Trading
          </button>
          
          <button 
            onClick={() => setActiveTab('notifications')}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium ${activeTab === 'notifications' ? 'bg-primary/20 text-primary' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
          >
            <Bell size={18} /> Notifications
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex flex-col relative">
          <button onClick={onClose} className="absolute top-6 right-6 text-gray-400 hover:text-white transition-colors bg-white/5 p-2 rounded-full">
            <X size={20} />
          </button>
          
          <div className="flex-1 overflow-y-auto p-10">
            {activeTab === 'general' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                <div>
                  <h3 className="text-xl font-bold mb-4">Localization</h3>
                  
                  <div className="mb-6 bg-black/40 border border-white/5 p-4 rounded-xl flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-white mb-1">Trading Mode</h4>
                      <p className="text-xs text-gray-400">Choose between local regional markets or global default markets.</p>
                    </div>
                    <div className="flex bg-white/5 rounded-lg p-1">
                      <button 
                        onClick={() => setMode('local')}
                        className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${mode === 'local' ? 'bg-primary text-background' : 'text-gray-400 hover:text-white'}`}
                      >
                        Local
                      </button>
                      <button 
                        onClick={() => setMode('global')}
                        className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${mode === 'global' ? 'bg-primary text-background' : 'text-gray-400 hover:text-white'}`}
                      >
                        Global
                      </button>
                    </div>
                  </div>

                  <div className={`grid grid-cols-2 gap-6 transition-opacity ${mode === 'global' ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                    <div>
                      <label className="text-sm text-gray-400 mb-2 block font-medium">Region</label>
                      <div className="flex flex-wrap gap-2">
                        {['NA', 'EU', 'UK', 'ASIA'].map(r => (
                          <button 
                            key={r}
                            onClick={() => setRegion(r as any)}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${region === r ? 'bg-primary text-background' : 'bg-white/5 hover:bg-white/10 text-gray-300'}`}
                          >
                            {r}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-sm text-gray-400 mb-2 block font-medium">Language</label>
                      <div className="flex flex-wrap gap-2">
                        {['en', 'es', 'fr'].map(l => (
                          <button 
                            key={l}
                            onClick={() => setLanguage(l as any)}
                            className={`px-4 py-2 rounded-lg text-sm font-bold uppercase transition-colors ${language === l ? 'bg-primary text-background' : 'bg-white/5 hover:bg-white/10 text-gray-300'}`}
                          >
                            {l === 'en' ? 'English' : l === 'es' ? 'Español' : 'Français'}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-sm text-gray-400 mb-2 block font-medium">Currency</label>
                      <div className="flex flex-wrap gap-2">
                        {['USD', 'EUR', 'GBP'].map(c => (
                          <button 
                            key={c}
                            onClick={() => setCurrency(c as any)}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${currency === c ? 'bg-primary text-background' : 'bg-white/5 hover:bg-white/10 text-gray-300'}`}
                          >
                            {c}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'trading' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                <div>
                  <h3 className="text-xl font-bold mb-4">Trading Preferences</h3>
                  
                  <div className="mb-6">
                    <label className="text-sm text-gray-400 mb-2 block font-medium">Max Slippage Tolerance</label>
                    <div className="flex items-center gap-3 mb-2">
                      {[0.1, 0.5, 1.0].map(val => (
                        <button 
                          key={val}
                          onClick={() => setSlippage(val)}
                          className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${slippage === val ? 'bg-primary text-background' : 'bg-white/5 hover:bg-white/10 text-gray-300'}`}
                        >
                          {val}%
                        </button>
                      ))}
                      <div className="flex-1 bg-black/40 border border-white/5 rounded-lg flex items-center px-3 py-2 focus-within:border-primary/50 transition-colors">
                        <input 
                          type="number" 
                          value={slippage} 
                          onChange={(e) => setSlippage(parseFloat(e.target.value) || 0)}
                          className="bg-transparent text-right font-bold outline-none w-full text-sm" 
                        />
                        <span className="text-gray-500 text-sm ml-1">%</span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500">Your transaction will revert if the price changes unfavorably by more than this percentage.</p>
                  </div>

                  <div className="glass-panel p-4 rounded-xl flex items-center justify-between">
                    <div>
                      <h4 className="font-bold mb-1 text-white">1-Click Trading</h4>
                      <p className="text-xs text-gray-400 max-w-[250px]">Skip the confirmation screen and submit orders immediately. Use with caution.</p>
                    </div>
                    <button 
                      onClick={() => setOneClickTrading(!oneClickTrading)}
                      className={`relative w-14 h-8 rounded-full transition-colors ${oneClickTrading ? 'bg-primary' : 'bg-white/10'}`}
                    >
                      <div className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform ${oneClickTrading ? 'translate-x-6' : 'translate-x-0'}`} />
                    </button>
                  </div>
                  
                  {oneClickTrading && (
                    <div className="mt-3 flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-yellow-400 text-xs font-medium">
                      <AlertTriangle size={16} className="shrink-0" />
                      <p>1-Click Trading is enabled. Orders will execute instantly without confirmation.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'notifications' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                <div>
                  <h3 className="text-xl font-bold mb-4">Notification Channels</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-black/40 rounded-xl border border-white/5">
                      <div>
                        <h4 className="font-bold text-white">Browser Push</h4>
                        <p className="text-xs text-gray-400">Receive native desktop notifications</p>
                      </div>
                      <button 
                        onClick={() => setNotifications({...notifications, browser: !notifications.browser})}
                        className={`relative w-12 h-6 rounded-full transition-colors ${notifications.browser ? 'bg-primary' : 'bg-white/10'}`}
                      >
                        <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${notifications.browser ? 'translate-x-6' : 'translate-x-0'}`} />
                      </button>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-black/40 rounded-xl border border-white/5">
                      <div>
                        <h4 className="font-bold text-white">Email Alerts</h4>
                        <p className="text-xs text-gray-400">Receive summary emails and critical alerts</p>
                      </div>
                      <button 
                        onClick={() => setNotifications({...notifications, email: !notifications.email})}
                        className={`relative w-12 h-6 rounded-full transition-colors ${notifications.email ? 'bg-primary' : 'bg-white/10'}`}
                      >
                        <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${notifications.email ? 'translate-x-6' : 'translate-x-0'}`} />
                      </button>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-xl font-bold mb-4">Event Alerts</h3>
                  <div className="space-y-3">
                    <label className="flex items-center justify-between p-3 rounded-lg hover:bg-white/5 transition-colors cursor-pointer">
                      <span className="text-sm font-medium text-gray-300">Order Filled</span>
                      <input type="checkbox" checked={notifications.orderFilled} onChange={() => setNotifications({...notifications, orderFilled: !notifications.orderFilled})} className="accent-primary w-4 h-4" />
                    </label>
                    <label className="flex items-center justify-between p-3 rounded-lg hover:bg-white/5 transition-colors cursor-pointer">
                      <span className="text-sm font-medium text-red-400">Liquidation Warnings</span>
                      <input type="checkbox" checked={notifications.liquidationWarning} onChange={() => setNotifications({...notifications, liquidationWarning: !notifications.liquidationWarning})} className="accent-red-500 w-4 h-4" />
                    </label>
                    <label className="flex items-center justify-between p-3 rounded-lg hover:bg-white/5 transition-colors cursor-pointer">
                      <span className="text-sm font-medium text-gray-300">Funding Rate Updates</span>
                      <input type="checkbox" checked={notifications.fundingRates} onChange={() => setNotifications({...notifications, fundingRates: !notifications.fundingRates})} className="accent-primary w-4 h-4" />
                    </label>
                  </div>
                </div>
              </div>
            )}
            
          </div>
        </div>
      </div>
    </div>
  );
}
