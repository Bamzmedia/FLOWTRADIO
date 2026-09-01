"use client";

import React, { useState } from 'react';
import { X, ArrowDownRight, ArrowUpRight, ShieldCheck, Loader2, Info } from 'lucide-react';
import { useWallet } from './WalletContext';

interface SubaccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  subaccountCollateral?: number;
  freeCollateral?: number;
}

export default function SubaccountModal({
  isOpen,
  onClose,
  subaccountCollateral = 0,
  freeCollateral = 0,
}: SubaccountModalProps) {
  const { isConnected, balance, addTransaction } = useWallet();
  const [mode, setMode] = useState<'deposit' | 'withdraw'>('deposit');
  const [amount, setAmount] = useState<string>('');
  const [subaccountName, setSubaccountName] = useState<string>('default');
  const [isProcessing, setIsProcessing] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  if (!isOpen) return null;

  const numAmount = parseFloat(amount) || 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected) {
      setFeedback({ type: 'error', msg: 'Please connect your Web3 wallet first.' });
      return;
    }
    if (numAmount <= 0) {
      setFeedback({ type: 'error', msg: 'Please enter a valid collateral amount.' });
      return;
    }

    if (mode === 'deposit' && numAmount > balance) {
      setFeedback({ type: 'error', msg: 'Insufficient USDC balance in connected wallet.' });
      return;
    }

    if (mode === 'withdraw' && numAmount > freeCollateral) {
      setFeedback({ type: 'error', msg: 'Requested amount exceeds free subaccount collateral.' });
      return;
    }

    setIsProcessing(true);
    setFeedback(null);

    try {
      // Simulate Nado Endpoint contract deposit Collateral / withdraw Collateral transaction
      await new Promise((res) => setTimeout(res, 1200));

      if (mode === 'deposit') {
        addTransaction({
          type: 'Deposit',
          amount: -numAmount,
          asset: 'USDC',
          network: 'Nado L2',
        });
        setFeedback({
          type: 'success',
          msg: `Successfully deposited $${numAmount.toFixed(2)} USDC to subaccount '${subaccountName}'!`,
        });
      } else {
        addTransaction({
          type: 'Withdraw',
          amount: numAmount,
          asset: 'USDC',
          network: 'Nado L2',
        });
        setFeedback({
          type: 'success',
          msg: `Successfully requested withdrawal of $${numAmount.toFixed(2)} USDC from subaccount '${subaccountName}'!`,
        });
      }

      setAmount('');
    } catch (err: any) {
      setFeedback({ type: 'error', msg: err.message || 'Collateral transaction failed.' });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#0b1329] border border-white/10 rounded-2xl max-w-md w-full p-6 shadow-2xl relative text-foreground font-sans">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <ShieldCheck size={20} className="text-primary" />
            <h2 className="text-lg font-bold text-white">Manage Subaccount Collateral</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Deposit / Withdraw Tabs */}
        <div className="flex bg-black/40 rounded-xl p-1 my-5 border border-white/5">
          <button
            type="button"
            onClick={() => {
              setMode('deposit');
              setFeedback(null);
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              mode === 'deposit'
                ? 'bg-green-500 text-background shadow-lg shadow-green-500/20'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <ArrowDownRight size={14} /> Deposit Collateral
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('withdraw');
              setFeedback(null);
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              mode === 'withdraw'
                ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/20'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <ArrowUpRight size={14} /> Withdraw Collateral
          </button>
        </div>

        {/* Balances Display */}
        <div className="grid grid-cols-2 gap-3 mb-5 text-xs font-mono">
          <div className="bg-black/30 border border-white/5 p-3 rounded-xl">
            <span className="text-gray-400 block mb-1 font-sans">Wallet Balance</span>
            <span className="font-bold text-white text-sm">${balance.toFixed(2)} USDC</span>
          </div>
          <div className="bg-black/30 border border-white/5 p-3 rounded-xl">
            <span className="text-gray-400 block mb-1 font-sans">Free Subaccount</span>
            <span className="font-bold text-green-400 text-sm">${freeCollateral.toFixed(2)} USDC</span>
          </div>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`p-3 rounded-xl mb-4 text-xs font-semibold border flex items-center gap-2 ${
              feedback.type === 'success'
                ? 'bg-green-950/80 border-green-500/30 text-green-300'
                : 'bg-red-950/80 border-red-500/30 text-red-300'
            }`}
          >
            <Info size={14} className="shrink-0" />
            <span>{feedback.msg}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Subaccount Identifier</label>
            <input
              type="text"
              value={subaccountName}
              onChange={(e) => setSubaccountName(e.target.value)}
              placeholder="default"
              className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-primary/50 transition-colors"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1 text-xs">
              <label className="font-medium text-gray-400">Amount (USDC)</label>
              <button
                type="button"
                onClick={() => setAmount(mode === 'deposit' ? balance.toString() : freeCollateral.toString())}
                className="text-primary font-bold hover:underline"
              >
                Max
              </button>
            </div>
            <div className="relative">
              <input
                type="number"
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-lg font-bold text-white outline-none focus:border-primary/50 transition-colors"
              />
              <span className="absolute right-3 top-3 text-xs font-bold text-gray-400">USDC</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={isProcessing}
            className={`w-full py-3 rounded-xl font-bold text-sm shadow-lg flex items-center justify-center gap-2 transition-all ${
              isProcessing
                ? 'bg-gray-600 cursor-not-allowed opacity-50'
                : mode === 'deposit'
                ? 'bg-green-500 hover:bg-green-400 text-background shadow-green-500/20'
                : 'bg-purple-500 hover:bg-purple-400 text-white shadow-purple-500/20'
            }`}
          >
            {isProcessing && <Loader2 size={16} className="animate-spin" />}
            {isProcessing
              ? 'Processing Transaction...'
              : mode === 'deposit'
              ? 'Confirm Deposit to Nado'
              : 'Confirm Withdrawal to Wallet'}
          </button>
        </form>
      </div>
    </div>
  );
}
