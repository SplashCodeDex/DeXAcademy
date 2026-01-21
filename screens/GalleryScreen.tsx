/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useEffect } from 'react';
import { ChevronLeft, ArrowUpRight, Globe, Lock } from 'lucide-react';
import { NativeStackScreenProps } from '../components/Navigation';
import { useGlobalState } from '../context/GlobalStateContext';
import { Header } from '../components/Header';
import { Haptics, ImpactFeedbackStyle } from '../lib/haptics';
import { FirestoreService } from '../services/firestoreService';
import { GeneratedMockup } from '../types';
import { LoadingSpinner } from '../components/LoadingSpinner';

export const GalleryScreen = ({ navigation }: NativeStackScreenProps<any, 'Gallery'>) => {
    const { savedMockups } = useGlobalState();
    const [tab, setTab] = useState<'private' | 'community'>('private');
    const [communityItems, setCommunityItems] = useState<GeneratedMockup[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        let mounted = true;

        if (tab === 'community') {
            setIsLoading(true);
            FirestoreService.getCommunityMockups()
                .then(items => {
                    if (mounted) setCommunityItems(items);
                })
                .catch(console.error)
                .finally(() => {
                    if (mounted) setIsLoading(false);
                });
        } else {
            // Immediately stop loading when switching to private (data is already in context)
            setIsLoading(false);
        }
        
        return () => { mounted = false; };
    }, [tab]);
    
    const items = tab === 'private' ? savedMockups : communityItems;

    return (
        <div className="bg-black flex-1 flex flex-col h-full animate-slide-in">
            <Header title="Gallery" leftAction={{ icon: <ChevronLeft />, onPress: navigation.goBack }} />
            
            <div className="px-4 mt-2 mb-4">
                <div className="flex bg-zinc-900 rounded-lg p-1">
                    <button 
                        onClick={() => setTab('private')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md transition-all ${tab === 'private' ? 'bg-zinc-800 text-white shadow' : 'text-zinc-500'}`}
                    >
                        <Lock size={14} />
                        <span className="text-xs font-bold">My Gallery</span>
                    </button>
                    <button 
                        onClick={() => setTab('community')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md transition-all ${tab === 'community' ? 'bg-indigo-600 text-white shadow' : 'text-zinc-500'}`}
                    >
                        <Globe size={14} />
                        <span className="text-xs font-bold">Community</span>
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 pb-24">
                {isLoading ? (
                    <div className="flex justify-center pt-20"><LoadingSpinner color="text-zinc-500" /></div>
                ) : items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-zinc-500 pt-32">
                        <span className="text-lg font-medium mb-2">No items found</span>
                        <p className="text-sm">Create something amazing!</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {items.map(m => (
                            <button 
                                key={m.id} 
                                onClick={() => {
                                    Haptics.impactAsync(ImpactFeedbackStyle.Light);
                                    navigation.navigate('Result', { result: m });
                                }}
                                className="aspect-square bg-zinc-900 rounded-xl overflow-hidden relative group border border-zinc-800 active:scale-95 transition-all"
                            >
                                <img src={m.imageUrl} className="w-full h-full object-cover" loading="lazy" />
                                
                                {tab === 'community' && (
                                    <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded-full z-10">
                                        <p className="text-[10px] text-white font-bold">
                                            {m.authorName || 'User'}
                                        </p>
                                    </div>
                                )}

                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-20">
                                    <div className="bg-white/20 p-2 rounded-full backdrop-blur-sm">
                                        <ArrowUpRight size={20} className="text-white" />
                                    </div>
                                </div>

                                <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/90 to-transparent z-10">
                                    <p className="text-white text-[10px] truncate opacity-80 font-mono">
                                        {new Date(m.createdAt).toLocaleDateString()}
                                    </p>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};