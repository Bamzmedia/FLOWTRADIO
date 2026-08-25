"use client";

import React, { useState } from 'react';
import { useWallet } from '@/components/WalletContext';
import { useLocalization } from '@/components/LocalizationContext';
import Navbar from '@/components/Navbar';
import { ArrowDownToLine, ArrowUpFromLine, ArrowRightLeft, Clock, ShieldCheck, AlertCircle } from 'lucide-react';
import Link from 'next/link';

export default function WalletPage() {
  const { isConnected, balance, network, transactions, addTransaction } = useWallet();
  const { formatCurrency, formatDate } = useLocalization();
  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw' | 'transfer'>('deposit');
  const [amount, setAmount] = useState('');
  
  if (!isConnected) {
    return (
      <div className="min-h-screen text-foreground font-sans flex flex-col pb-20 relative">
        <Navbar />
        <main className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <ShieldCheck size={64} className="text-gray-500 mb-4 opacity-50" />
          <h2 className="text-2xl font-bold mb-2">Wallet Disconnected</h2>
          <p className="text-gray-400 max-w-md mb-6">Please connect your wallet using the button in the top right corner to view your assets and transaction history.</p>
        </main>
      </div>
    );
  }

  const handleAction = () => {
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      alert("Please enter a valid amount!");
      return;
    }
    if (activeTab === 'withdraw' && numAmount > balance) {
      alert("Insufficient balance for withdrawal!");
      return;
    }
    
    // Simulate transaction
    addTransaction({
      type: activeTab === 'deposit' ? 'Deposit' : activeTab === 'withdraw' ? 'Withdraw' : 'Transfer',
      amount: numAmount,
      asset: 'USDC',
      network: network,
    });
    
    alert(`Successfully submitted ${activeTab} request for ${numAmount} USDC!`);
    setAmount('');
  };

  return (
    <div className="min-h-screen text-foreground font-sans flex flex-col pb-20 relative">
      <Navbar />

      <main className="flex-1 flex flex-col p-6 md:p-12 relative max-w-7xl mx-auto w-full">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-primary/10 rounded-full blur-[150px] -z-10 mix-blend-screen pointer-events-none" />

        <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-4xl font-extrabold mb-2">Asset Management</h1>
            <p className="text-gray-400 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> Connected to {network}
            </p>
          </div>
          <div className="glass-panel px-6 py-4 rounded-2xl flex flex-col items-end">
            <span className="text-sm text-gray-400 mb-1">Total Available Margin</span>
            <span className="text-3xl font-bold text-white">{formatCurrency(balance)}</span>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          
          {/* Action Interface (Deposit/Withdraw/Transfer) */}
          <div className="lg:col-span-1 h-fit glass-panel rounded-3xl p-6 shadow-2xl relative border-t-primary/20 border-t">
            
            <div className="flex bg-black/40 rounded-xl p-1 mb-6">
              <button 
                onClick={() => setActiveTab('deposit')}
                className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-1 ${activeTab === 'deposit' ? 'bg-primary text-background shadow-lg shadow-primary/20' : 'text-gray-400 hover:text-gray-200'}`}
              >
                <ArrowDownToLine size={14} /> Deposit
              </button>
              <button 
                onClick={() => setActiveTab('withdraw')}
                className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-1 ${activeTab === 'withdraw' ? 'bg-white/10 text-white shadow-lg' : 'text-gray-400 hover:text-gray-200'}`}
              >
                <ArrowUpFromLine size={14} /> Withdraw
              </button>
              <button 
                onClick={() => setActiveTab('transfer')}
                className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-1 ${activeTab === 'transfer' ? 'bg-white/10 text-white shadow-lg' : 'text-gray-400 hover:text-gray-200'}`}
              >
                <ArrowRightLeft size={14} /> Transfer
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-black/40 border border-white/5 rounded-2xl p-4 focus-within:border-primary/50 transition-colors">
                <div className="text-sm text-gray-400 mb-2 font-medium">Asset</div>
                <button className="flex items-center gap-2 glass-panel w-full px-4 py-3 rounded-xl hover:bg-white/10 transition-colors justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-blue-500 shadow-lg shadow-blue-500/20" />
                    <span className="font-bold text-lg">USDC</span>
                  </div>
                </button>
              </div>

              {activeTab === 'transfer' && (
                <div className="bg-black/40 border border-white/5 rounded-2xl p-4 focus-within:border-primary/50 transition-colors">
                  <div className="text-sm text-gray-400 mb-2 font-medium flex justify-between">
                    <span>Destination Address</span>
                  </div>
                  <input type="text" placeholder="0x..." className="bg-transparent text-lg font-mono outline-none w-full" />
                </div>
              )}

              <div className="bg-black/40 border border-white/5 rounded-2xl p-4 focus-within:border-primary/50 transition-colors">
                <div className="text-sm text-gray-400 mb-2 font-medium flex justify-between">
                  <span>Amount</span>
                  <span>Bal: {formatCurrency(balance)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <input 
                    type="number" 
                    placeholder="0.0" 
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="bg-transparent text-3xl font-bold outline-none w-full" 
                  />
                  <button onClick={() => setAmount(balance.toString())} className="text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded">MAX</button>
                </div>
              </div>

              {activeTab === 'withdraw' && (
                <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs">
                  <AlertCircle size={14} className="shrink-0 mt-0.5" />
                  <p>Withdrawals require a security confirmation and may take up to 5 minutes to process on the {network} network.</p>
                </div>
              )}

              <button 
                onClick={handleAction}
                disabled={!amount || parseFloat(amount) <= 0 || (activeTab === 'withdraw' && parseFloat(amount) > balance)}
                className={`w-full font-bold py-4 rounded-2xl transition-all duration-300 shadow-lg flex justify-center items-center gap-2 ${(!amount || parseFloat(amount) <= 0 || (activeTab === 'withdraw' && parseFloat(amount) > balance)) ? 'bg-white/5 text-gray-500 cursor-not-allowed' : 'bg-primary text-background hover:bg-primary/80 shadow-primary/20'}`}
              >
                {activeTab === 'deposit' ? 'Confirm Deposit' : activeTab === 'withdraw' ? 'Submit Withdrawal' : 'Transfer Funds'}
              </button>
            </div>
          </div>

          {/* Transaction History Table */}
          <div className="lg:col-span-2 glass-panel rounded-3xl overflow-hidden flex flex-col border-t-white/10 border-t shadow-2xl">
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <h3 className="text-lg font-bold flex items-center gap-2"><Clock size={18} /> Transaction History</h3>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-black/20 text-gray-400 text-xs uppercase tracking-wider border-b border-white/5">
                    <th className="py-4 px-6 font-medium">Type</th>
                    <th className="py-4 px-6 font-medium text-right">Amount</th>
                    <th className="py-4 px-6 font-medium">Date</th>
                    <th className="py-4 px-6 font-medium">Network</th>
                    <th className="py-4 px-6 font-medium text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {transactions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-gray-500">
                        No transactions found.
                      </td>
                    </tr>
                  ) : (
                    transactions.map((tx) => (
                      <tr key={tx.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td className="py-4 px-6 font-medium">
                          <span className={`px-2 py-1 rounded text-xs ${tx.type === 'Deposit' ? 'bg-green-500/10 text-green-400' : tx.type === 'Withdraw' ? 'bg-red-500/10 text-red-400' : tx.type === 'Trade' ? 'bg-blue-500/10 text-blue-400' : 'bg-gray-500/10 text-gray-300'}`}>
                            {tx.type}
                          </span>
                          {(tx.takeProfit || tx.stopLoss) && (
                            <div className="text-[10px] text-gray-500 mt-2 font-mono">
                              {tx.takeProfit && <span className="mr-2">TP: <span className="text-green-500/70">{tx.takeProfit}</span></span>} 
                              {tx.stopLoss && <span>SL: <span className="text-red-500/70">{tx.stopLoss}</span></span>}
                            </div>
                          )}
                        </td>
                        <td className={`py-4 px-6 text-right font-mono font-medium ${tx.amount > 0 ? 'text-green-400' : tx.amount < 0 ? 'text-white' : ''}`}>
                          {tx.amount > 0 ? '+' : ''}{formatCurrency(tx.amount)} {tx.asset}
                        </td>
                        <td className="py-4 px-6 text-gray-400 text-xs">
                          {formatDate(tx.date)}
                        </td>
                        <td className="py-4 px-6">
                          <span className="text-xs bg-white/5 px-2 py-1 rounded border border-white/10">{tx.network}</span>
                        </td>
                        <td className="py-4 px-6 text-right">
                          <span className={`text-xs font-bold ${tx.status === 'Completed' ? 'text-green-400' : tx.status === 'Pending' ? 'text-yellow-400 animate-pulse' : 'text-red-400'}`}>
                            {tx.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
          
        </div>
      </main>
    </div>
  );
}
