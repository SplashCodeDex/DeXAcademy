/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useEffect, useState } from 'react';
import { ChevronLeft, Info, DownloadCloud, Database, ChevronRight, Activity, ShieldCheck } from 'lucide-react';
import { NativeStackScreenProps } from '../components/Navigation';
import { useGlobalState } from '../context/GlobalStateContext';
import { Header } from '../components/Header';
import { Haptics, NotificationFeedbackType } from '../lib/haptics';
import { apiKeyManager } from '../services/apiKeyManager';

interface SettingsItemProps {
    icon: React.ReactNode;
    label: string;
    onPress: () => void;
    destructive?: boolean;
}

export const SettingsScreen = ({ navigation }: NativeStackScreenProps<any, 'Settings'>) => {
  const { resetData, loadTemplates } = useGlobalState();
  const [poolStatus, setPoolStatus] = useState<ReturnType<typeof apiKeyManager.getPoolStatus>>([]);

  useEffect(() => {
    setPoolStatus(apiKeyManager.getPoolStatus());
    const interval = setInterval(() => {
        setPoolStatus(apiKeyManager.getPoolStatus());
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleReset = () => {
    if (confirm("Are you sure? This will delete all your saved mockups and assets.")) {
        resetData();
        Haptics.notificationAsync(NotificationFeedbackType.Success);
    }
  };

  const handleLoadTemplates = () => {
     loadTemplates();
     Haptics.notificationAsync(NotificationFeedbackType.Success);
     alert("Templates loaded!");
  };

  const SettingsItem: React.FC<SettingsItemProps> = ({ icon, label, onPress, destructive }) => (
    <button 
      onClick={onPress} 
      className="w-full flex flex-row items-center justify-between p-4 bg-zinc-900 border-b border-zinc-800 active:bg-zinc-800 first:rounded-t-xl last:rounded-b-xl last:border-0"
    >
       <div className="flex flex-row items-center">
          <div className={`mr-4 ${destructive ? 'text-red-500' : 'text-zinc-400'}`}>
            {icon}
          </div>
          <span className={`font-medium text-base ${destructive ? 'text-red-500' : 'text-white'}`}>{label}</span>
       </div>
       <ChevronRight size={20} className="text-zinc-600" />
    </button>
  );

  return (
    <div className="bg-black flex-1 flex flex-col h-full">
       <Header 
         title="Settings" 
         leftAction={{ icon: <ChevronLeft />, onPress: navigation.goBack }} 
       />
       <div className="flex-1 overflow-y-auto pt-4 pb-[calc(env(safe-area-inset-bottom)+20px)]">
          
          {/* Network Health Section */}
          <div className="px-4 mb-2"><span className="text-zinc-500 uppercase text-xs font-bold">Network Health (Hydra API)</span></div>
          <div className="mx-4 mb-6 bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
             <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Activity size={18} className="text-indigo-400" />
                    <span className="font-bold text-sm">Key Pool Status</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-400">{poolStatus.filter(k => !k.isCoolingDown).length} / {poolStatus.length} Active</span>
                </div>
             </div>
             <div className="p-2 space-y-1">
                 {poolStatus.length === 0 ? (
                    <div className="p-2 text-zinc-500 text-xs text-center">No API Keys Configured</div>
                 ) : (
                    poolStatus.map((key, i) => (
                        <div key={i} className="flex items-center justify-between p-2 rounded bg-zinc-800/50">
                            <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${key.state === 'CLOSED' ? 'bg-green-500' : key.state === 'HALF_OPEN' ? 'bg-amber-500' : 'bg-red-500'}`} />
                                <span className="text-xs font-mono text-zinc-300">...{key.id}</span>
                            </div>
                            <div className="flex items-center gap-3">
                                {key.failures > 0 && (
                                    <span className="text-[10px] text-red-400 font-bold bg-red-900/30 px-1 rounded">{key.failures} Fail</span>
                                )}
                                <span className="text-xs text-zinc-500">{key.total} Req</span>
                            </div>
                        </div>
                    ))
                 )}
             </div>
          </div>

          <div className="px-4 mb-2"><span className="text-zinc-500 uppercase text-xs font-bold">General</span></div>
          <div className="flex flex-col mx-4 mb-6">
             <SettingsItem 
               icon={<Info size={20} />} 
               label="About Mockup Studio" 
               onPress={() => alert("Mockup Studio v3.0\nProduction Build")} 
             />
             <SettingsItem 
               icon={<DownloadCloud size={20} />} 
               label="Load Demo Templates" 
               onPress={handleLoadTemplates} 
             />
          </div>

          <div className="px-4 mb-2"><span className="text-zinc-500 uppercase text-xs font-bold">Data</span></div>
          <div className="flex flex-col mx-4">
             <SettingsItem 
               icon={<Database size={20} />} 
               label="Reset to Defaults" 
               onPress={handleReset} 
               destructive
             />
          </div>
          
          <div className="p-8 flex flex-col items-center justify-center gap-2">
             <div className="flex items-center gap-1 text-zinc-600">
                <ShieldCheck size={12} />
                <span className="text-xs">Secure Enclave Active</span>
             </div>
             <span className="text-zinc-600 text-xs">Build 2024.11.07</span>
          </div>
       </div>
    </div>
  );
};