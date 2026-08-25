"use client";

import React, { createContext, useContext, useState, ReactNode } from 'react';

type Language = 'en' | 'es' | 'fr';
type Currency = 'USD' | 'EUR' | 'GBP';
type Region = 'NA' | 'EU' | 'UK' | 'ASIA';
export type Theme = 'dark' | 'light' | 'system';
export type TradingMode = 'local' | 'global';

export interface NotificationsState {
  email: boolean;
  browser: boolean;
  telegram: boolean;
  orderFilled: boolean;
  liquidationWarning: boolean;
  fundingRates: boolean;
}

interface LocalizationState {
  language: Language;
  currency: Currency;
  region: Region;
  theme: Theme;
  mode: TradingMode;
  slippage: number;
  oneClickTrading: boolean;
  notifications: NotificationsState;
  t: (key: string) => string;
  setLanguage: (lang: Language) => void;
  setCurrency: (curr: Currency) => void;
  setRegion: (reg: Region) => void;
  setTheme: (theme: Theme) => void;
  setMode: (mode: TradingMode) => void;
  setSlippage: (slippage: number) => void;
  setOneClickTrading: (enabled: boolean) => void;
  setNotifications: (settings: NotificationsState) => void;
  formatCurrency: (amount: number) => string;
  formatDate: (date: Date) => string;
  getRegionalTrending: () => { asset: string; change: number }[];
}

// Simple translation dictionary for mock purposes
const translations = {
  en: {
    dashboard: 'Dashboard',
    trade: 'Easy Trade',
    markets: 'Nado Markets',
    earn: 'Simple Earn',
    portfolio: 'Total Portfolio Value',
    pnl: 'Total PnL',
    volume: '24h Trading Volume',
    swap: 'Quick Swap',
    positions: 'Open Positions',
    orders: 'Orders',
    activity: 'Recent Activity',
    connect: 'Connect Wallet',
    noPositions: 'No Open Positions',
    noPositionsDesc: "You don't have any open trading positions right now.",
    morning: "Good morning",
    afternoon: "Good afternoon",
    evening: "Good evening",
    trending_in: "Trending in",
    trending_global: "Global Trending",
    swapTitle: 'Quick Swap',
    swapSubtitle: 'Instantly exchange tokens with minimal slippage.',
    youPay: 'You Pay',
    youReceive: 'You Receive',
    confirmSwap: 'Confirm Swap',
  },
  es: {
    dashboard: 'Panel',
    trade: 'Intercambio Fácil',
    markets: 'Mercados Nado',
    earn: 'Ganancia Simple',
    portfolio: 'Valor Total del Portafolio',
    pnl: 'PyG Total',
    volume: 'Volumen 24h',
    swap: 'Intercambio Rápido',
    positions: 'Posiciones Abiertas',
    orders: 'Órdenes',
    activity: 'Actividad Reciente',
    connect: 'Conectar Billetera',
    noPositions: 'Sin Posiciones',
    noPositionsDesc: "No tienes posiciones abiertas en este momento.",
    morning: "Buenos días",
    afternoon: "Buenas tardes",
    evening: "Buenas noches",
    trending_in: "Tendencia en",
    trending_global: "Tendencia Global",
    swapTitle: 'Intercambio Rápido',
    swapSubtitle: 'Intercambia tokens instantáneamente con un deslizamiento mínimo.',
    youPay: 'Tú Pagas',
    youReceive: 'Tú Recibes',
    confirmSwap: 'Confirmar Intercambio',
  },
  fr: {
    dashboard: 'Tableau de Bord',
    trade: 'Échange Facile',
    markets: 'Marchés Nado',
    earn: 'Gains Simples',
    portfolio: 'Valeur du Portefeuille',
    pnl: 'Pertes et Profits',
    volume: 'Volume 24h',
    swap: 'Échange Rapide',
    positions: 'Positions Ouvertes',
    orders: 'Commandes',
    activity: 'Activité Récente',
    connect: 'Connecter le Portefeuille',
    noPositions: 'Aucune Position',
    noPositionsDesc: "Vous n'avez aucune position ouverte pour le moment.",
    morning: "Bonjour",
    afternoon: "Bon après-midi",
    evening: "Bonsoir",
    trending_in: "Tendance en",
    trending_global: "Tendance Mondiale",
    swapTitle: 'Échange Rapide',
    swapSubtitle: 'Échangez instantanément des jetons avec un glissement minimal.',
    youPay: 'Vous Payez',
    youReceive: 'Vous Recevez',
    confirmSwap: 'Confirmer l\'Échange',
  }
};

const regionalData = {
  NA: [
    { asset: 'BTC-PERP', change: 2.4 },
    { asset: 'SOL-PERP', change: 8.5 },
    { asset: 'AVAX-PERP', change: 1.5 },
  ],
  EU: [
    { asset: 'ETH-PERP', change: -1.2 },
    { asset: 'EUR-PERP', change: 0.8 },
    { asset: 'LINK-PERP', change: -4.2 },
  ],
  UK: [
    { asset: 'GBP-PERP', change: 0.5 },
    { asset: 'BTC-PERP', change: 2.4 },
    { asset: 'MATIC-PERP', change: 0.5 },
  ],
  ASIA: [
    { asset: 'NADO-PERP', change: 12.4 },
    { asset: 'ARB-PERP', change: 4.2 },
    { asset: 'DOGE-PERP', change: -8.5 },
  ],
  GLOBAL: [
    { asset: 'BTC-PERP', change: 2.4 },
    { asset: 'ETH-PERP', change: -1.2 },
    { asset: 'NADO-PERP', change: 12.4 },
  ]
};

const LocalizationContext = createContext<LocalizationState | undefined>(undefined);

export function LocalizationProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>('en');
  const [currency, setCurrency] = useState<Currency>('USD');
  const [region, setRegion] = useState<Region>('NA');
  const [theme, setTheme] = useState<Theme>('dark');
  const [mode, setMode] = useState<TradingMode>('local');
  const [slippage, setSlippage] = useState<number>(0.5);
  const [oneClickTrading, setOneClickTrading] = useState<boolean>(false);
  const [trendingData, setTrendingData] = useState<{ asset: string; change: number }[]>([]);
  const [notifications, setNotifications] = useState<NotificationsState>({
    email: false, browser: true, telegram: false,
    orderFilled: true, liquidationWarning: true, fundingRates: false
  });

  // Apply theme to document element for global CSS variables
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const activeTheme = theme === 'system' 
        ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') 
        : theme;
      document.documentElement.setAttribute('data-theme', activeTheme);
    }
  }, [theme]);

  // Fetch live trending data from API
  React.useEffect(() => {
    fetch('/api/markets')
      .then(res => res.json())
      .then(data => {
        if (data && Array.isArray(data.data)) {
          // Sort by 24h change descending
          const sorted = data.data.sort((a: any, b: any) => b.change24h - a.change24h).slice(0, 5);
          setTrendingData(sorted.map((m: any) => ({ asset: m.symbol, change: m.change24h })));
        }
      })
      .catch(err => console.error("Failed to fetch trending:", err));
  }, []);

  const t = (key: string) => {
    return translations[language][key as keyof typeof translations['en']] || key;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat(language === 'en' ? 'en-US' : language === 'fr' ? 'fr-FR' : 'es-ES', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat(language === 'en' ? 'en-US' : language === 'fr' ? 'fr-FR' : 'es-ES', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    }).format(date);
  };

  const getRegionalTrending = () => {
    return trendingData.length > 0 ? trendingData : (mode === 'global' ? regionalData['GLOBAL'] : regionalData[region]);
  };

  return (
    <LocalizationContext.Provider value={{ 
      language, currency, region, theme, mode, slippage, oneClickTrading, notifications,
      t, setLanguage, setCurrency, setRegion, setTheme, setMode, setSlippage, setOneClickTrading, setNotifications,
      formatCurrency, formatDate, getRegionalTrending 
    }}>
      {children}
    </LocalizationContext.Provider>
  );
}

export function useLocalization() {
  const context = useContext(LocalizationContext);
  if (context === undefined) {
    throw new Error('useLocalization must be used within a LocalizationProvider');
  }
  return context;
}
