"use client";

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Loader2, CheckCircle2, AlertCircle, ExternalLink, X } from 'lucide-react';

export type TxStatus = 'waiting_wallet' | 'submitted' | 'confirming' | 'success' | 'error';

export interface TransactionDetails {
  orderId?: string;
  price?: number;
  amount?: number;
  side?: string;
  market?: string;
  execMode?: string;
  pnl?: number;
}

interface Transaction {
  id: string;
  title: string;
  status: TxStatus;
  hash?: string;
  errorMessage?: string;
  details?: TransactionDetails;
}

interface TransactionFeedbackContextType {
  transactions: Transaction[];
  startTransaction: (title: string) => string;
  updateTransaction: (id: string, updates: Partial<Omit<Transaction, 'id'>>) => void;
  dismissTransaction: (id: string) => void;
  simulateTransaction: (title: string) => Promise<void>;
}

const TransactionFeedbackContext = createContext<TransactionFeedbackContextType | undefined>(undefined);

export function TransactionFeedbackProvider({ children }: { children: ReactNode }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const startTransaction = (title: string) => {
    const id = Date.now().toString();
    setTransactions(prev => [...prev, { id, title, status: 'waiting_wallet' }]);
    return id;
  };

  const updateTransaction = (id: string, updates: Partial<Omit<Transaction, 'id'>>) => {
    setTransactions(prev => prev.map(tx => (tx.id === id ? { ...tx, ...updates } : tx)));
  };

  const dismissTransaction = (id: string) => {
    setTransactions(prev => prev.filter(tx => tx.id !== id));
  };

  const simulateTransaction = async (title: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const txId = startTransaction(title);
      
      // Waiting for wallet (1.5s)
      setTimeout(() => {
        const hash = '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
        updateTransaction(txId, { status: 'submitted', hash });
        
        // Confirming (2s)
        setTimeout(() => {
          updateTransaction(txId, { status: 'confirming' });
          
          // Success (1.5s)
          setTimeout(() => {
            updateTransaction(txId, { status: 'success' });
            resolve();
            
            // Auto dismiss after 4 seconds
            setTimeout(() => {
              dismissTransaction(txId);
            }, 4000);
          }, 1500);
        }, 2000);
      }, 1500);
    });
  };

  return (
    <TransactionFeedbackContext.Provider value={{ transactions, startTransaction, updateTransaction, dismissTransaction, simulateTransaction }}>
      {children}
      
      {/* Toast Container - Elevated above taskbar */}
      <div className="fixed bottom-24 sm:bottom-28 right-4 sm:right-6 z-50 flex flex-col gap-2.5 pointer-events-none w-[360px] max-w-[calc(100vw-32px)]">
        {transactions.map(tx => (
          <div key={tx.id} className="pointer-events-auto glass-panel bg-[#0b1329]/95 border border-primary/30 rounded-xl p-4 shadow-[0_12px_40px_rgba(0,0,0,0.85)] backdrop-blur-xl flex flex-col gap-2.5 transform transition-all translate-y-0 opacity-100">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${tx.status === 'success' ? 'bg-green-400' : tx.status === 'error' ? 'bg-red-400' : 'bg-primary animate-pulse'}`} />
                <h4 className="text-sm font-bold text-white">{tx.title}</h4>
              </div>
              <div className="flex items-center gap-1.5">
                {tx.details?.execMode && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-gray-300 font-mono">
                    {tx.details.execMode}
                  </span>
                )}
                {tx.status === 'success' || tx.status === 'error' ? (
                  <button onClick={() => dismissTransaction(tx.id)} className="text-gray-400 hover:text-white transition-colors p-1" title="Dismiss">
                    <X size={15} />
                  </button>
                ) : null}
              </div>
            </div>
            
            <div className="flex items-center gap-2 text-xs font-medium">
              {tx.status === 'waiting_wallet' && (
                <><Loader2 size={14} className="animate-spin text-primary" /><span className="text-primary font-semibold">Confirm in wallet...</span></>
              )}
              {tx.status === 'submitted' && (
                <><Loader2 size={14} className="animate-spin text-yellow-400" /><span className="text-yellow-400 font-semibold">Transaction submitted</span></>
              )}
              {tx.status === 'confirming' && (
                <><Loader2 size={14} className="animate-spin text-blue-400" /><span className="text-blue-400 font-semibold">Confirming on-chain...</span></>
              )}
              {tx.status === 'success' && (
                <><CheckCircle2 size={14} className="text-green-400" /><span className="text-green-400 font-bold">Confirmed successfully!</span></>
              )}
              {tx.status === 'error' && (
                <><AlertCircle size={14} className="text-red-400" /><span className="text-red-400 font-semibold">{tx.errorMessage || 'Transaction failed'}</span></>
              )}
            </div>

            {/* Rich Trade Details */}
            {tx.details && (
              <div className="mt-1 pt-2 border-t border-white/10 text-[11px] font-mono text-gray-300 space-y-1 bg-black/30 p-2 rounded-lg">
                {tx.details.market && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Market:</span>
                    <span className="font-bold text-white flex items-center gap-1">
                      {tx.details.side && (
                        <span className={`px-1.5 py-0.2 rounded text-[10px] font-sans font-bold ${
                          tx.details.side.toUpperCase().includes('LONG') || tx.details.side.toUpperCase() === 'BUY'
                            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                            : 'bg-red-500/20 text-red-400 border border-red-500/30'
                        }`}>
                          {tx.details.side}
                        </span>
                      )}
                      {tx.details.market}
                    </span>
                  </div>
                )}
                {tx.details.price !== undefined && tx.details.price > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Execution Price:</span>
                    <span className="text-green-400 font-bold">${tx.details.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</span>
                  </div>
                )}
                {tx.details.amount !== undefined && tx.details.amount > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Size:</span>
                    <span className="text-white font-bold">{tx.details.amount.toFixed(4)}</span>
                  </div>
                )}
                {tx.details.orderId && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Order Ref:</span>
                    <span className="text-gray-300 font-mono text-[10px]">{tx.details.orderId.slice(0, 16)}...</span>
                  </div>
                )}
              </div>
            )}

            {tx.hash && (
              <a 
                href={`https://explorer.inkonchain.com/tx/${tx.hash}`}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-primary hover:underline font-mono flex items-center gap-1 mt-1 w-max transition-colors"
              >
                View on Ink Explorer <ExternalLink size={11} />
              </a>
            )}
          </div>
        ))}
      </div>
    </TransactionFeedbackContext.Provider>
  );
}

export const useTransactionFeedback = () => {
  const context = useContext(TransactionFeedbackContext);
  if (context === undefined) {
    throw new Error('useTransactionFeedback must be used within a TransactionFeedbackProvider');
  }
  return context;
};
