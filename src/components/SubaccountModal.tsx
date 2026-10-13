"use client";

import React, { useState, useRef } from 'react';
import { X, ArrowDownRight, ArrowUpRight, ShieldCheck, Loader2, Info, AlertTriangle } from 'lucide-react';
import { useWallet } from './WalletContext';
import { ethers } from 'ethers';
import { withdrawCollateral } from '../nado/nadoApi';

interface SubaccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  subaccountCollateral?: number;
  freeCollateral?: number;
  onSuccess?: () => void;
}

export default function SubaccountModal({
  isOpen,
  onClose,
  subaccountCollateral = 0,
  freeCollateral = 0,
  onSuccess,
}: SubaccountModalProps) {
  const { isConnected, walletProvider, balance, walletUsdcBalance, nadoFreeCollateral, refetchBalance, addTransaction, network } = useWallet();
  const [mode, setMode] = useState<'deposit' | 'withdraw'>('deposit');
  const [amount, setAmount] = useState<string>('');
  const [subaccountName, setSubaccountName] = useState<string>('default');
  const [isProcessing, setIsProcessing] = useState(false);
  const isProcessingRef = useRef(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; msg: string } | null>(null);

  if (!isOpen) return null;

  const endpointContract = process.env.NEXT_PUBLIC_NADO_ENDPOINT_CONTRACT || '0x05ec92D78ED421f3D3Ada77FFdE167106565974E';
  const isContractConfigured =
    Boolean(endpointContract) &&
    endpointContract !== '0x0000000000000000000000000000000000000000' &&
    endpointContract?.startsWith('0x') &&
    endpointContract?.length === 42;

  const numAmount = parseFloat(amount) || 0;
  const availableFree = nadoFreeCollateral > 0 
    ? nadoFreeCollateral 
    : (freeCollateral > 0 ? freeCollateral : (subaccountCollateral > 0 ? subaccountCollateral : 0));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isProcessingRef.current || isProcessing) return;

    if (!isConnected) {
      setFeedback({ type: 'error', msg: 'Please connect your Web3 wallet first.' });
      return;
    }

    if (mode === 'deposit' && !isContractConfigured) {
      setFeedback({
        type: 'info',
        msg: 'On-chain testnet collateral contract deployment is pending. Direct on-chain settlement will activate once the endpoint contract is deployed on Ink Testnet.',
      });
      return;
    }

    if (mode === 'withdraw' && availableFree <= 0) {
      setFeedback({
        type: 'error',
        msg: 'No available margin on Nado DEX to withdraw. Please deposit collateral first.',
      });
      return;
    }

    if (numAmount <= 0) {
      setFeedback({ type: 'error', msg: 'Please enter a valid collateral amount.' });
      return;
    }

    const maxDeposit = walletUsdcBalance > 0 ? walletUsdcBalance : balance;
    if (mode === 'deposit' && maxDeposit > 0 && numAmount > maxDeposit) {
      setFeedback({ type: 'error', msg: 'Insufficient USDC balance in connected wallet.' });
      return;
    }

    if (mode === 'withdraw' && availableFree > 0 && numAmount > availableFree) {
      setFeedback({ type: 'error', msg: 'Requested amount exceeds free subaccount collateral.' });
      return;
    }

    isProcessingRef.current = true;
    setIsProcessing(true);
    setFeedback(null);

    try {
      const providerSource = walletProvider || (typeof window !== 'undefined' ? (window as any).ethereum : null);
      if (!providerSource) throw new Error('No Web3 wallet provider available.');

      const provider = new ethers.BrowserProvider(providerSource);
      const signer = await provider.getSigner();

      if (mode === 'deposit') {
        const userAddr = await signer.getAddress();
        const usdt0Address = '0x0200C29006150606B650577BBE7B6248F58470c1';
        const usdcAddress = '0x2D270e6886d130D724215A266106e6832161EAEd';

        const erc20Abi = [
          'function approve(address spender, uint256 amount) public returns (bool)',
          'function allowance(address owner, address spender) public view returns (uint256)',
          'function balanceOf(address account) public view returns (uint256)'
        ];

        const usdt0Token = new ethers.Contract(usdt0Address, erc20Abi, signer);
        const usdcToken = new ethers.Contract(usdcAddress, erc20Abi, signer);

        const tokenAmount = ethers.parseUnits(numAmount.toFixed(6), 6); // 6 decimals

        const [usdt0Bal, usdcBal] = await Promise.all([
          usdt0Token.balanceOf(userAddr).catch(() => BigInt(0)),
          usdcToken.balanceOf(userAddr).catch(() => BigInt(0)),
        ]);

        let depositToken = usdt0Token;
        let depositProductId = 0;
        let tokenName = 'USD₮0';
        if (usdcBal >= tokenAmount || usdcBal > usdt0Bal) {
          depositToken = usdcToken;
          depositProductId = 5;
          tokenName = 'USDC';
        }

        const currentAllowance = await depositToken.allowance(userAddr, endpointContract!);
        if (currentAllowance < tokenAmount) {
          setFeedback({ type: 'info', msg: `Approving ${tokenName} for Nado Endpoint...` });
          const txApprove = await depositToken.approve(endpointContract!, tokenAmount);
          await txApprove.wait();
        }

        setFeedback({ type: 'info', msg: `Depositing ${tokenName} on Ink Mainnet...` });
        
        const endpointAbi = [
          'function depositCollateral(bytes12 subaccountName, uint32 productId, uint128 amount) external',
        ];
        const endpoint = new ethers.Contract(endpointContract!, endpointAbi, signer);
        
        // Pure JS safe 12-byte subaccount hex
        let nameHex = '';
        for (let i = 0; i < 12; i++) {
          if (i < subaccountName.length) {
            nameHex += subaccountName.charCodeAt(i).toString(16).padStart(2, '0');
          } else {
            nameHex += '00';
          }
        }
        const subaccountBytes12 = '0x' + nameHex;

        const tx = await endpoint.depositCollateral(subaccountBytes12, depositProductId, tokenAmount);
        await tx.wait();
        refetchBalance();
        setFeedback({
          type: 'success',
          msg: `Deposit of $${numAmount.toFixed(2)} ${tokenName} confirmed on Ink!`,
        });
      } else {
        // Off-chain withdrawal via sequencer
        setFeedback({ type: 'info', msg: 'Signing withdrawal request...' });
        const sender = await signer.getAddress();
        const withdrawAmount = numAmount;
        
        let withdrawalSent = false;
        let lastErr: any = null;

        try {
          await withdrawCollateral(5, withdrawAmount, sender, signer, subaccountName || 'default');
          withdrawalSent = true;
        } catch (err1: any) {
          lastErr = err1;
          console.warn('[Withdraw] Product 5 note:', err1);
          try {
            await withdrawCollateral(0, withdrawAmount, sender, signer, subaccountName || 'default');
            withdrawalSent = true;
          } catch (err2: any) {
            lastErr = err2;
            console.warn('[Withdraw] Product 0 note:', err2);
          }
        }

        if (!withdrawalSent && lastErr) {
          const errMsg = (lastErr.message || '').toLowerCase();
          if (
            errMsg.includes('no previous deposits') ||
            errMsg.includes('prior deposits')
          ) {
            throw new Error('Nado Sequencer rejected withdrawal: Your address has no previous deposits on Nado. Please deposit funds first.');
          }
          throw lastErr;
        }

        setFeedback({
          type: 'success',
          msg: `Withdrawal of $${numAmount.toFixed(2)} USDC submitted to Nado!`,
        });

        addTransaction?.({
          type: 'Withdraw',
          amount: numAmount,
          asset: 'USDC',
          network: network || 'Ink',
        });

        refetchBalance();
      }

      setAmount('');
      onSuccess?.();
    } catch (err: any) {
      setFeedback({ type: 'error', msg: err.message || 'Collateral transaction failed.' });
    } finally {
      isProcessingRef.current = false;
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
            className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
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
            className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
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
            className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              mode === 'withdraw'
                ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/20'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <ArrowUpRight size={14} /> Withdraw Collateral
          </button>
        </div>

        {/* On-chain Testnet Status Notice (Deposit only) */}
        {!isContractConfigured && mode === 'deposit' && (
          <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300 flex items-start gap-2.5">
            <AlertTriangle size={16} className="shrink-0 mt-0.5 text-amber-400" />
            <div>
              <span className="font-bold block text-amber-200">Testnet Settlement Notice</span>
              On-chain collateral deposit contracts on Ink Testnet are currently pending official protocol deployment. Direct on-chain deposit will activate once the endpoint smart contract address is configured.
            </div>
          </div>
        )}

        {/* Balances Display */}
        <div className="grid grid-cols-2 gap-3 mb-5 text-xs font-mono">
          <div className="bg-black/30 border border-white/5 p-3 rounded-xl">
            <span className="text-gray-400 block mb-1 font-sans">Wallet USDC</span>
            <span className="font-bold text-white text-sm">${walletUsdcBalance.toFixed(2)} USDC</span>
          </div>
          <div className="bg-black/30 border border-white/5 p-3 rounded-xl">
            <span className="text-gray-400 block mb-1 font-sans">Available Margin</span>
            <span className="font-bold text-green-400 text-sm">${availableFree.toFixed(2)} USDC</span>
          </div>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`p-3 rounded-xl mb-4 text-xs font-semibold border flex items-center gap-2 ${
              feedback.type === 'success'
                ? 'bg-green-950/80 border-green-500/30 text-green-300'
                : feedback.type === 'info'
                ? 'bg-amber-950/80 border-amber-500/30 text-amber-300'
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
                onClick={() => setAmount(mode === 'deposit' ? (walletUsdcBalance > 0 ? walletUsdcBalance.toString() : balance.toString()) : (availableFree > 0 ? availableFree.toString() : '0'))}
                className="text-primary font-bold hover:underline cursor-pointer"
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
            disabled={isProcessing || (mode === 'deposit' && !isContractConfigured) || numAmount <= 0 || (mode === 'withdraw' && (availableFree <= 0 || numAmount > availableFree))}
            className={`w-full py-3 rounded-xl font-bold text-sm shadow-lg flex items-center justify-center gap-2 transition-all ${
              mode === 'deposit' && !isContractConfigured
                ? 'bg-white/10 text-gray-400 cursor-not-allowed border border-white/5'
                : isProcessing
                ? 'bg-purple-600/70 text-white cursor-wait'
                : numAmount <= 0 || (mode === 'withdraw' && (availableFree <= 0 || numAmount > availableFree))
                ? 'bg-white/10 text-gray-500 cursor-not-allowed'
                : mode === 'deposit'
                ? 'bg-green-500 hover:bg-green-400 text-background shadow-green-500/20 cursor-pointer'
                : 'bg-purple-500 hover:bg-purple-400 text-white shadow-purple-500/20 cursor-pointer'
            }`}
          >
            {isProcessing && <Loader2 size={16} className="animate-spin" />}
            {mode === 'deposit' && !isContractConfigured
              ? 'On-Chain Deposits Pending Deployment'
              : isProcessing
              ? (mode === 'deposit' ? 'Processing Deposit...' : 'Processing Withdrawal...')
              : mode === 'withdraw' && availableFree <= 0
              ? 'No Deposited Margin to Withdraw'
              : mode === 'withdraw' && numAmount > availableFree
              ? 'Insufficient Free Margin'
              : mode === 'deposit'
              ? 'Confirm Deposit to Nado'
              : 'Confirm Withdrawal to Wallet'}
          </button>
        </form>
      </div>
    </div>
  );
}

