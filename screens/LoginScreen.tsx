/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState } from 'react';
import { Package, ArrowRight, Lock, Mail, AlertCircle } from 'lucide-react';
import { AuthService } from '../services/authService';
import { Button } from '../components/Button';
import { LoadingSpinner } from '../components/LoadingSpinner';

export const LoginScreen = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    
    setIsLoading(true);
    setError(null);

    try {
        if (isLogin) {
            await AuthService.login(email, password);
        } else {
            await AuthService.register(email, password);
        }
    } catch (err: unknown) {
        console.error(err);
        setError(AuthService.formatError(err));
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 bg-black flex flex-col items-center justify-center p-6 relative overflow-y-auto h-full">
       {/* Background Ambience */}
       <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none fixed">
          <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-indigo-600/20 rounded-full blur-[120px]" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[400px] h-[400px] bg-purple-600/20 rounded-full blur-[100px]" />
       </div>

       <div className="w-full max-w-sm z-10 animate-slide-up my-auto">
           <div className="flex flex-col items-center mb-10 mt-10">
                <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center mb-6 shadow-2xl shadow-indigo-500/30 transform rotate-3">
                    <Package size={40} className="text-white" />
                </div>
                <h1 className="text-3xl font-black text-white text-center">Mockup Studio</h1>
                <p className="text-zinc-400 mt-2">AI Product Visualization</p>
           </div>

           <div className="bg-zinc-900/50 backdrop-blur-xl border border-white/10 p-8 rounded-3xl shadow-xl mb-10">
               <div className="flex gap-4 mb-6 bg-black/30 p-1 rounded-xl">
                   <button 
                    onClick={() => { setIsLogin(true); setError(null); }}
                    className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${isLogin ? 'bg-zinc-800 text-white shadow' : 'text-zinc-500 hover:text-zinc-300'}`}
                   >
                       Login
                   </button>
                   <button 
                    onClick={() => { setIsLogin(false); setError(null); }}
                    className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${!isLogin ? 'bg-zinc-800 text-white shadow' : 'text-zinc-500 hover:text-zinc-300'}`}
                   >
                       Sign Up
                   </button>
               </div>

               <form onSubmit={handleAuth} className="space-y-4">
                   <div className="space-y-1">
                       <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Email</label>
                       <div className="relative">
                           <Mail className="absolute left-3 top-3.5 text-zinc-500" size={18} />
                           <input 
                                type="email" 
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                className="w-full bg-black/40 border border-zinc-700 rounded-xl py-3 pl-10 pr-4 text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all outline-none"
                                placeholder="name@example.com"
                                required
                           />
                       </div>
                   </div>

                   <div className="space-y-1">
                       <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Password</label>
                       <div className="relative">
                           <Lock className="absolute left-3 top-3.5 text-zinc-500" size={18} />
                           <input 
                                type="password" 
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                className="w-full bg-black/40 border border-zinc-700 rounded-xl py-3 pl-10 pr-4 text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all outline-none"
                                placeholder="••••••••"
                                required
                           />
                       </div>
                   </div>

                   {error && (
                       <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-lg flex items-center gap-2 text-red-400 text-sm">
                           <AlertCircle size={16} />
                           {error}
                       </div>
                   )}

                   <Button 
                    type="submit" 
                    className="w-full mt-2 h-12 text-lg" 
                    disabled={isLoading}
                   >
                       {isLoading ? <LoadingSpinner color="text-white" /> : (
                           <div className="flex items-center">
                               {isLogin ? 'Sign In' : 'Create Account'}
                               <ArrowRight size={18} className="ml-2" />
                           </div>
                       )}
                   </Button>
               </form>
           </div>
           
           <p className="text-center text-zinc-600 text-xs mb-8">
               Data is stored securely on your device.
           </p>
       </div>
    </div>
  );
};