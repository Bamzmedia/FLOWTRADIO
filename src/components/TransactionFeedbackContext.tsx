"use client";

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Loader2, CheckCircle2, AlertCircle, ExternalLink, X } from 'lucide-react';

export type TxStatus = 'waiting_wallet' | 'submitted' | 'confirming' | 'success' | 'error';

interface Transaction {
  id: string;
  title: string;
  status: TxStatus;
  hash?: string;
  errorMessage?: string;
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
      
      {/* Toast Container */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none w-[320px]">
        {transactions.map(tx => (
          <div key={tx.id} className="pointer-events-auto glass-panel bg-black/80 border border-white/10 rounded-xl p-4 shadow-2xl flex flex-col gap-2 transform transition-all translate-y-0 opacity-100">
            <div className="flex justify-between items-start">
              <h4 className="text-sm font-bold text-white">{tx.title}</h4>
              {tx.status === 'success' || tx.status === 'error' ? (
                <button onClick={() => dismissTransaction(tx.id)} className="text-gray-400 hover:text-white transition-colors">
                  <X size={16} />
                </button>
              ) : null}
            </div>
            
            <div className="flex items-center gap-2 text-xs font-medium">
              {tx.status === 'waiting_wallet' && (
                <><Loader2 size={14} className="animate-spin text-primary" /><span className="text-primary">Confirm in wallet</span></>
              )}
              {tx.status === 'submitted' && (
                <><Loader2 size={14} className="animate-spin text-yellow-400" /><span className="text-yellow-400">Transaction submitted</span></>
              )}
              {tx.status === 'confirming' && (
                <><Loader2 size={14} className="animate-spin text-blue-400" /><span className="text-blue-400">Confirming...</span></>
              )}
              {tx.status === 'success' && (
                <><CheckCircle2 size={14} className="text-green-500" /><span className="text-green-500">Transaction successful</span></>
              )}
              {tx.status === 'error' && (
                <><AlertCircle size={14} className="text-red-500" /><span className="text-red-500">{tx.errorMessage || 'Transaction failed'}</span></>
              )}
            </div>

            {tx.hash && (
              <a 
                href={`https://explorer.inkonchain.com/tx/${tx.hash}`}
                target="_blank"
                rel="noreferrer"
                className="text-[10px] text-gray-500 hover:text-primary flex items-center gap-1 mt-1 w-max transition-colors"
              >
                View on Explorer <ExternalLink size={10} />
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
