/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, PlayCircle, Coins, Clock, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { NativeStackScreenProps } from '../components/Navigation';
import { useGlobalState } from '../context/GlobalStateContext';
import { iapService, Product } from '../services/iapService';
import { adService } from '../services/adService';
import { FirestoreService, TransactionRecord } from '../services/firestoreService';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Header } from '../components/Header';
import { LoadingSpinner } from '../components/LoadingSpinner';

const HistoryItem: React.FC<{ item: TransactionRecord }> = ({ item }) => (
    <div className="flex items-center justify-between py-3 border-b border-zinc-800 last:border-0">
        <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${item.amount > 0 ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                {item.amount > 0 ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
            </div>
            <div className="flex flex-col">
                <span className="text-white text-sm font-medium">{item.description}</span>
                <span className="text-zinc-500 text-xs">{new Date(item.timestamp).toLocaleDateString()}</span>
            </div>
        </div>
        <span className={`font-mono font-bold ${item.amount > 0 ? 'text-green-500' : 'text-zinc-400'}`}>
            {item.amount > 0 ? '+' : ''}{item.amount}
        </span>
    </div>
);

export const StoreScreen = ({ navigation }: NativeStackScreenProps<any, 'Store'>) => {
  const { credits, addCredits } = useGlobalState();
  const { user } = useAuth();
  const { showToast } = useToast();
  
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [history, setHistory] = useState<TransactionRecord[]>([]);
  const [viewHistory, setViewHistory] = useState(false);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    
    // Load Products
    iapService.getProducts().then(p => {
        if (isMounted.current) setProducts(p);
    });

    // Load History
    if (user) {
        FirestoreService.getTransactions(user.uid).then(t => {
            if (isMounted.current) setHistory(t);
        });
    }

    return () => { isMounted.current = false; };
  }, [user, credits]); // Reload history when credits change

  const handlePurchase = async (product: Product) => {
    setLoadingId(product.id);
    try {
        const result = await iapService.purchaseProduct(product.id);
        if (!isMounted.current) return;

        if (result.success) {
            await addCredits(result.credits); 
            // Also save receipt logic if needed
            showToast(`Purchased ${result.credits} Credits`);
        } else {
            if (result.error) showToast(result.error, 'error');
        }
    } catch (e) {
        if (isMounted.current) showToast("Purchase Failed", 'error');
    } finally {
        if (isMounted.current) setLoadingId(null);
    }
  };

  const handleWatchAd = async () => {
      setLoadingId('ad_reward');
      try {
          const success = await adService.showRewardedAd();
          if (!isMounted.current) return;

          if (success) {
              await addCredits(1);
              showToast("Reward Earned: 1 Credit");
          } else {
              showToast("Ad cancelled or unavailable", 'info');
          }
      } catch (e) {
          if (isMounted.current) showToast("Ad Service Error", 'error');
      } finally {
          if (isMounted.current) setLoadingId(null);
      }
  };

  return (
    <div className="bg-black flex-1 flex flex-col h-full animate-slide-in">
       <Header title="Store" leftAction={{ icon: <ChevronLeft />, onPress: navigation.goBack }} />
       
       <div className="flex-1 overflow-y-auto px-4 pb-12">
           {/* Header Banner */}
           <div className="mt-4 mb-8 text-center bg-gradient-to-b from-indigo-900/20 to-transparent p-6 rounded-2xl border border-indigo-500/20">
               <span className="text-zinc-400 text-xs font-bold uppercase tracking-widest mb-2 block">Current Balance</span>
               <div className="text-5xl font-black text-white mb-2 flex items-center justify-center gap-2">
                    <Coins size={32} className="text-yellow-500" />
                    {credits}
               </div>
               <p className="text-zinc-500 text-sm">Credits are used for AI generation and high-res exports.</p>
           </div>

           {/* Toggle */}
           <div className="flex bg-zinc-900 rounded-lg p-1 mb-6">
                <button 
                    onClick={() => setViewHistory(false)}
                    className={`flex-1 py-2 rounded-md text-sm font-bold transition-all ${!viewHistory ? 'bg-zinc-800 text-white shadow' : 'text-zinc-500'}`}
                >
                    Buy Credits
                </button>
                <button 
                    onClick={() => setViewHistory(true)}
                    className={`flex-1 py-2 rounded-md text-sm font-bold transition-all ${viewHistory ? 'bg-zinc-800 text-white shadow' : 'text-zinc-500'}`}
                >
                    History
                </button>
           </div>

           {viewHistory ? (
               <div className="flex flex-col">
                   {history.length === 0 ? (
                       <div className="text-center text-zinc-500 py-12">
                           <Clock size={48} className="mx-auto mb-4 opacity-50" />
                           <p>No transaction history</p>
                       </div>
                   ) : (
                       history.map(item => <HistoryItem key={item.id} item={item} />)
                   )}
               </div>
           ) : (
               <div className="space-y-4">
                   {/* Ad Reward */}
                   <button 
                     onClick={handleWatchAd}
                     disabled={loadingId !== null}
                     className="w-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 p-4 rounded-xl flex items-center justify-between group active:scale-95 transition-all"
                   >
                       <div className="flex items-center gap-4">
                           <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 group-hover:bg-purple-500 group-hover:text-white transition-colors">
                               {loadingId === 'ad_reward' ? <LoadingSpinner size={20} color="text-current"/> : <PlayCircle size={24} />}
                           </div>
                           <div className="text-left">
                               <div className="text-white font-bold">Watch Ad</div>
                               <div className="text-purple-400 text-xs font-bold">+1 Credit Free</div>
                           </div>
                       </div>
                   </button>

                   {/* IAP Products */}
                   {products.map(p => (
                       <button 
                         key={p.id}
                         onClick={() => handlePurchase(p)}
                         disabled={loadingId !== null}
                         className={`w-full p-4 rounded-xl flex items-center justify-between group active:scale-95 transition-all border ${p.popular ? 'bg-indigo-900/20 border-indigo-500/50' : 'bg-zinc-900 border-zinc-800'}`}
                       >
                           <div className="flex items-center gap-4">
                               <div className="flex flex-col text-left">
                                   <div className="flex items-center gap-2">
                                        <span className="text-white font-bold text-lg">{p.credits} Credits</span>
                                        {p.popular && <span className="bg-indigo-500 text-white text-[10px] px-1.5 py-0.5 rounded font-bold uppercase">Popular</span>}
                                   </div>
                                   <div className="text-zinc-500 text-xs">{p.title}</div>
                               </div>
                           </div>
                           <div className={`px-4 py-2 rounded-lg font-bold text-sm min-w-[80px] flex justify-center ${p.popular ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-white'}`}>
                               {loadingId === p.id ? <LoadingSpinner size={16} color="text-white"/> : p.price}
                           </div>
                       </button>
                   ))}
               </div>
           )}
       </div>
    </div>
  );
};