/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React from 'react';
import { 
  Package, 
  Settings2, 
  Wallet, 
  Plus, 
  Camera as CameraIcon, 
  Image as ImageIcon,
  Wand2,
  Sparkles,
  FileEdit,
  ChevronRight,
  Download,
  LogOut
} from 'lucide-react';
import { NativeStackScreenProps } from '../components/Navigation';
import { useGlobalState } from '../context/GlobalStateContext';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/Button';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { LoadingSpinner } from '../components/LoadingSpinner';

export const DashboardScreen = ({ navigation }: NativeStackScreenProps<any, 'Dashboard'>) => {
  const { credits, draft, isSyncing } = useGlobalState();
  const { isSupported, promptInstall } = usePWAInstall();
  const { logout, user } = useAuth();

  return (
    <div className="bg-black flex-1 flex flex-col h-full animate-slide-in">
      <div className="flex-1 overflow-y-auto px-6 pt-[calc(env(safe-area-inset-top)+20px)]">
        <div className="flex flex-row justify-between mb-4">
           {/* Wallet Badge */}
           <button 
              onClick={() => navigation.navigate('Store')}
              className="flex flex-row items-center bg-zinc-900 px-3 py-1.5 rounded-full border border-zinc-800"
           >
              <Wallet size={16} className="text-indigo-400 mr-2" />
              <span className="text-white font-bold mr-1 text-sm">{credits}</span>
              <div className="w-2 h-2 rounded-full bg-green-500" />
           </button>

           <div className="flex gap-2">
               {isSyncing && (
                   <div className="p-2 bg-zinc-900 rounded-full flex items-center justify-center">
                       <LoadingSpinner size={16} color="text-zinc-500" />
                   </div>
               )}
               <button onClick={() => navigation.navigate('Settings')} className="p-2 bg-zinc-900 rounded-full text-zinc-400">
                  <Settings2 size={24} />
               </button>
           </div>
        </div>
        
        <div className="flex flex-col items-center mb-12 mt-8">
          <div className="w-20 h-20 bg-indigo-900/30 rounded-3xl flex items-center justify-center mb-6 border border-indigo-500/30 relative">
            <Package size={40} className="text-indigo-400" />
            <div className="absolute -top-2 -right-2 bg-green-500 text-black text-[10px] font-bold px-2 py-0.5 rounded-full">PRO</div>
          </div>
          <h1 className="text-4xl font-black text-white text-center mb-2">Mockup Studio</h1>
          <p className="text-zinc-400 text-center text-sm px-4 leading-6">
            Logged in as <span className="text-white font-mono">{user?.email}</span>
          </p>
          
          <div className="flex gap-2 mt-6">
              {isSupported && (
                <button 
                  onClick={promptInstall}
                  className="flex items-center gap-2 bg-zinc-800 px-4 py-2 rounded-full border border-zinc-700 text-indigo-400 font-bold text-sm animate-pop-in"
                >
                  <Download size={16} />
                  Install App
                </button>
              )}
              <button 
                  onClick={() => { if(confirm("Log out?")) logout(); }}
                  className="flex items-center gap-2 bg-zinc-900 px-4 py-2 rounded-full border border-zinc-800 text-red-400 font-bold text-sm hover:bg-zinc-800 transition-colors"
                >
                  <LogOut size={16} />
                  Logout
              </button>
          </div>
        </div>

        <div className="space-y-4 mb-8">
          {/* Resume Project Conditional Card */}
          {draft && (draft.productId || draft.layers.length > 0) && (
             <button 
                onClick={() => navigation.navigate('Studio')}
                className="w-full bg-indigo-900/20 border border-indigo-500/50 p-4 rounded-xl flex flex-row items-center justify-between group active:scale-95 transition-all"
             >
                <div className="flex flex-row items-center">
                    <FileEdit size={24} className="text-indigo-400 mr-4" />
                    <div className="text-left">
                        <div className="text-white font-bold text-base">Resume Project</div>
                        <div className="text-zinc-400 text-xs">Continue where you left off</div>
                    </div>
                </div>
                <ChevronRight size={20} className="text-indigo-400 group-hover:translate-x-1 transition-transform" />
             </button>
          )}

          <Button onClick={() => navigation.navigate('Assets')} icon={<Plus size={20} />} className="w-full h-16 text-lg">
            Start New Project
          </Button>
          <Button onClick={() => navigation.navigate('TryOn')} variant="secondary" icon={<CameraIcon size={20} />} className="w-full h-14">
            AR Camera Try-On
          </Button>
          <Button onClick={() => navigation.navigate('Gallery')} variant="ghost" icon={<ImageIcon size={20} />} className="w-full h-14">
            View Gallery
          </Button>
        </div>

        <div className="flex flex-row justify-between mb-8 gap-4">
          <button onClick={() => navigation.navigate('Studio')} className="bg-zinc-900 rounded-xl p-4 flex-1 flex flex-col items-center border border-zinc-800 active:bg-zinc-800">
            <Wand2 size={24} className="text-purple-400 mb-2" />
            <span className="text-zinc-400 text-xs font-bold uppercase">Smart Blend</span>
          </button>
          <button onClick={() => navigation.navigate('Assets')} className="bg-zinc-900 rounded-xl p-4 flex-1 flex flex-col items-center border border-zinc-800 active:bg-zinc-800">
            <Sparkles size={24} className="text-amber-400 mb-2" />
            <span className="text-zinc-400 text-xs font-bold uppercase">AI Generated</span>
          </button>
        </div>
      </div>
    </div>
  );
};