import React, { useState } from 'react';
import { X, ShieldAlert, CheckCircle2, TrendingUp } from 'lucide-react';
import { useLocalization } from './LocalizationContext';
import { useWallet } from './WalletContext';

interface Trader {
  rank: number;
  name: string;
  address: string;
  roi: number;
  pnl: number;
  winRate: number;
  volume: number;
}

interface CopyTradeModalProps {
  trader: Trader;
  onClose: () => void;
}

export default function CopyTradeModal({ trader, onClose }: CopyTradeModalProps) {
  const { formatCurrency } = useLocalization();
  const { isConnected, balance, addTransaction, network } = useWallet();
  const [amount, setAmount] = useState('');
  const [stopLoss, setStopLoss] = useState(20);
  const [status, setStatus] = useState<'idle' | 'copying' | 'success'>('idle');

  const handleCopy = () => {
    if (!isConnected || parseFloat(amount) <= 0 || parseFloat(amount) > balance) return;
    
    setStatus('copying');
    
    // Simulate network delay
    setTimeout(() => {
      addTransaction({
        type: 'Trade',
        amount: -parseFloat(amount),
        asset: 'USDC',
        network: network,
      });
      setStatus('success');
    }, 1500);
  };

  if (status === 'success') {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="glass-panel w-full max-w-md rounded-3xl p-8 flex flex-col items-center text-center animate-in zoom-in-95 duration-200 border border-green-500/30 shadow-[0_0_50px_rgba(34,197,94,0.1)]">
          <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mb-6">
            <CheckCircle2 size={40} className="text-green-500" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Copy Trade Active!</h2>
          <p className="text-gray-400 mb-8">
            You are now successfully copying <strong className="text-white">{trader.name}</strong> with {formatCurrency(parseFloat(amount))}. Your portfolio will automatically mirror their future trades.
          </p>
          <button 
            onClick={onClose}
            className="w-full py-4 bg-white/10 hover:bg-white/20 font-bold rounded-2xl transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="glass-panel w-full max-w-md rounded-3xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        <div className="flex justify-between items-center p-6 border-b border-white/10">
          <h2 className="text-xl font-bold flex items-center gap-2">
            Copy <span className="text-primary">{trader.name}</span>
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Trader Stats Overview */}
          <div className="bg-black/40 rounded-2xl p-4 flex justify-between border border-white/5">
            <div>
              <div className="text-xs text-gray-500 mb-1">Win Rate</div>
              <div className="font-bold">{trader.winRate}%</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">ROI</div>
              <div className="font-bold text-green-400">+{trader.roi}%</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Followers</div>
              <div className="font-bold">1,204</div>
            </div>
          </div>

          {/* Allocation Input */}
          <div>
            <div className="flex justify-between text-sm mb-2">
              <label className="font-semibold text-gray-300">Copy Amount (USD)</label>
              <span className="text-gray-500">Available: {formatCurrency(isConnected ? balance : 0)}</span>
            </div>
            <div className="bg-black/40 border border-white/5 rounded-2xl p-4 flex justify-between items-center focus-within:border-primary/50 transition-colors">
              <input 
                type="number" 
                placeholder="0.00" 
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="bg-transparent text-2xl font-bold outline-none w-full" 
              />
              <button 
                onClick={() => isConnected && setAmount(balance.toString())}
                className="text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded ml-2"
              >
                MAX
              </button>
            </div>
          </div>

          {/* Stop Loss Slider */}
          <div>
            <div className="flex justify-between text-sm mb-2">
              <label className="font-semibold text-gray-300 flex items-center gap-1">
                <ShieldAlert size={14} className="text-orange-400"/> Stop Loss
              </label>
              <span className="font-bold text-orange-400">-{stopLoss}%</span>
            </div>
            <p className="text-xs text-gray-500 mb-3">Automatically stop copying if drawdown reaches this percentage.</p>
            <input 
              type="range" 
              min="5" 
              max="100" 
              value={stopLoss}
              onChange={(e) => setStopLoss(parseInt(e.target.value))}
              className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-orange-500" 
            />
          </div>

          {/* Execution Button */}
          <button 
            onClick={handleCopy}
            disabled={!isConnected || !amount || parseFloat(amount) <= 0 || parseFloat(amount) > balance || status === 'copying'}
            className={`w-full font-bold py-4 rounded-2xl transition-all duration-300 shadow-lg flex justify-center items-center gap-2 ${
              (!isConnected || !amount || parseFloat(amount) <= 0 || parseFloat(amount) > balance)
                ? 'bg-white/5 text-gray-500 cursor-not-allowed' 
                : 'bg-primary text-background hover:bg-primary/80 shadow-primary/20'
            }`}
          >
            {!isConnected 
              ? 'Connect Wallet to Copy' 
              : status === 'copying' 
                ? <span className="flex items-center gap-2"><div className="w-4 h-4 border-2 border-background border-t-transparent rounded-full animate-spin"></div> Processing...</span>
                : `Confirm Copy Trade`}
          </button>
        </div>

      </div>
    </div>
  );
}
