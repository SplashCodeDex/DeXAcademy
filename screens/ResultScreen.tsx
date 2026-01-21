/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, Package, Sparkles, Send, History, Globe, Copy, Download, Trash2, Layers } from 'lucide-react';
import { NativeStackScreenProps } from '../components/Navigation';
import { useGlobalState } from '../context/GlobalStateContext';
import { useAuth } from '../context/AuthContext';
import { useApiKey } from '../hooks/useApiKey';
import { useToast } from '../context/ToastContext';
import { Button } from '../components/Button';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { refineImage } from '../services/geminiService';
import { FirestoreService } from '../services/firestoreService';
import { Haptics, NotificationFeedbackType } from '../lib/haptics';

export const ResultScreen = ({ navigation, route }: NativeStackScreenProps<any, 'Result'>) => {
  const { result: initialResult } = route.params;
  const { saveMockup, deleteMockup, spendCredits, addCredits, updateDraft, assets } = useGlobalState();
  const { validateApiKey } = useApiKey();
  const { showToast } = useToast();
  const { user } = useAuth();
  
  // Versions Array: [Original, Refine 1, Refine 2, ...]
  const [versions, setVersions] = useState<string[]>([initialResult.imageUrl]);
  const [selectedVersionIndex, setSelectedVersionIndex] = useState(0);
  
  const currentImageUrl = versions[selectedVersionIndex];
  
  const [promptInput, setPromptInput] = useState('');
  const [fullPromptHistory, setFullPromptHistory] = useState(initialResult.prompt);
  
  const [isRefining, setIsRefining] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isComparing, setIsComparing] = useState(false);

  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // Check if this is a community item (Read Only Mode)
  const isCommunityItem = initialResult.authorId && initialResult.authorId !== user?.uid;

  const handleShare = async () => {
    if (navigator.share) {
        try {
            const shareData: ShareData = { 
                title: 'SKU Foundry', 
                text: `My AI Mockup: ${fullPromptHistory}` 
            };

            if (currentImageUrl.startsWith('data:')) {
                const response = await fetch(currentImageUrl);
                const blob = await response.blob();
                const type = blob.type;
                const ext = type === 'image/jpeg' ? 'jpg' : 'png';
                const file = new File([blob], `mockup.${ext}`, { type });
                if (navigator.canShare && navigator.canShare({ files: [file] })) {
                    shareData.files = [file];
                } else {
                    shareData.url = currentImageUrl; 
                }
            } else {
                shareData.url = currentImageUrl;
            }

            await navigator.share(shareData);
        } catch (e) {
            console.warn("Share failed or cancelled", e);
        }
    } else {
        showToast("Share not supported", 'error');
    }
  };

  const handleSave = () => {
      saveMockup({
          ...initialResult,
          imageUrl: currentImageUrl,
          prompt: fullPromptHistory,
          createdAt: Date.now()
      });
      showToast('Saved to Private Gallery');
  };

  const handleDelete = () => {
      if (confirm("Delete this mockup permanently?")) {
          deleteMockup(initialResult.id);
          showToast("Mockup Deleted");
          navigation.goBack();
      }
  };

  const handleRemix = () => {
      if (initialResult.layers && initialResult.productId) {
          const productExists = assets.some(a => a.id === initialResult.productId);
          if (!productExists) {
              showToast("Original product asset is missing", 'error');
              return;
          }

          const validLayers = initialResult.layers.filter(l => assets.some(a => a.id === l.assetId));
          
          if (validLayers.length === 0 && initialResult.layers.length > 0) {
              showToast("All logo assets for this design are missing", 'error');
              return;
          }

          if (validLayers.length < initialResult.layers.length) {
              showToast("Some layers were removed because assets are missing", 'info');
          }

          updateDraft({
              productId: initialResult.productId,
              layers: validLayers
          });
          showToast('Project Loaded');
          navigation.replace('Studio');
      } else {
          showToast("No remix data available", 'error');
      }
  };

  const handlePublish = async () => {
      if (!user) return;
      setIsPublishing(true);
      try {
          const mockupToPublish = {
              ...initialResult,
              imageUrl: currentImageUrl,
              prompt: fullPromptHistory,
              createdAt: Date.now()
          };
          
          await saveMockup(mockupToPublish);
          await FirestoreService.publishMockup(user.uid, user.email || 'Anonymous', mockupToPublish);
          
          if (isMounted.current) showToast('Published to Community!');
      } catch (e) {
          console.error(e);
          if (isMounted.current) showToast("Failed to Publish", 'error');
      } finally {
          if (isMounted.current) setIsPublishing(false);
      }
  };

  const handleRefine = async (e?: React.FormEvent) => {
      e?.preventDefault();
      if (!promptInput.trim()) return;
      
      if (!spendCredits(1)) {
          showToast("Insufficient Credits", 'error');
          return;
      }
      
      if (!(await validateApiKey())) {
          addCredits(1);
          return;
      }

      setIsRefining(true);

      try {
          const newImage = await refineImage(currentImageUrl, promptInput);
          
          if (isMounted.current) {
              // Add new version and select it
              setVersions(prev => [...prev, newImage]);
              setSelectedVersionIndex(prev => prev + 1);
              
              setFullPromptHistory(prev => `${prev} + ${promptInput}`);
              setPromptInput('');
              showToast('Image Refined');
          }
      } catch (err: any) {
          console.error(err);
          addCredits(1);
          Haptics.notificationAsync(NotificationFeedbackType.Error);
          const msg = (err.message || err.toString()).toLowerCase();
          
          if (isMounted.current) {
              if (msg.includes('safety') || msg.includes('blocked')) {
                showToast("Blocked: Safety filters triggered", 'error');
              } else if (msg.includes('exhausted')) {
                showToast("System Busy: Try again later", 'error');
              } else {
                showToast("Refinement failed. Credits refunded", 'error');
              }
          }
      } finally {
          if (isMounted.current) setIsRefining(false);
      }
  };

  return (
    <div className="bg-black flex-1 flex flex-col h-full overflow-hidden">
      <div className="flex-1 flex flex-col relative">
        {/* Main Image View */}
        <div className="flex-1 bg-zinc-900 m-4 rounded-2xl overflow-hidden relative shadow-2xl border border-zinc-800 group">
            <div className="absolute inset-0 pattern-grid opacity-10 pointer-events-none" />
            
            {/* Show original if comparing, otherwise current version */}
            <img 
                src={isComparing ? versions[0] : currentImageUrl} 
                className={`w-full h-full object-contain transition-opacity duration-300 ${isRefining ? 'opacity-50 blur-sm' : 'opacity-100'}`} 
            />

            {isRefining && (
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-indigo-500/10 to-transparent animate-scan z-10 pointer-events-none" />
            )}

            {isRefining && (
                <div className="absolute inset-0 flex items-center justify-center z-20">
                    <div className="bg-black/70 backdrop-blur-md px-6 py-4 rounded-full flex items-center gap-3 border border-indigo-500/30 shadow-xl">
                        <LoadingSpinner color="text-indigo-400" />
                        <span className="text-white font-medium animate-pulse">Refining...</span>
                    </div>
                </div>
            )}

            <button onClick={() => navigation.goBack()} className="absolute top-4 left-4 bg-black/50 hover:bg-black/70 p-2 rounded-full text-white backdrop-blur-md border border-white/10 transition-colors z-30">
                <ChevronLeft />
            </button>
            
            {isCommunityItem && (
                 <div className="absolute top-4 right-4 bg-indigo-600/90 backdrop-blur-md px-3 py-1 rounded-full border border-indigo-400/30 z-30 shadow-lg">
                    <span className="text-white text-xs font-bold flex items-center gap-1">
                        <Globe size={12} /> Community
                    </span>
                 </div>
            )}

            {/* Hold to Compare (Only if we have refined versions) */}
            {versions.length > 1 && !isRefining && (
                <button 
                    onMouseDown={() => setIsComparing(true)}
                    onMouseUp={() => setIsComparing(false)}
                    onMouseLeave={() => setIsComparing(false)}
                    onTouchStart={() => setIsComparing(true)}
                    onTouchEnd={() => setIsComparing(false)}
                    onContextMenu={(e) => e.preventDefault()}
                    className="absolute top-4 right-4 bg-black/50 hover:bg-black/70 px-3 py-1.5 rounded-full text-white backdrop-blur-md border border-white/10 transition-all active:scale-95 flex items-center gap-2 z-30"
                >
                    <History size={14} className="text-zinc-300" />
                    <span className="text-xs font-bold uppercase tracking-wider">Original</span>
                </button>
            )}
        </div>
        
        {/* Version Filmstrip */}
        {versions.length > 1 && (
            <div className="px-4 mb-3 overflow-x-auto scrollbar-hide">
                <div className="flex gap-2">
                    {versions.map((v, idx) => (
                        <button
                            key={idx}
                            onClick={() => setSelectedVersionIndex(idx)}
                            className={`relative w-12 h-12 rounded-lg overflow-hidden border-2 transition-all flex-shrink-0 ${selectedVersionIndex === idx ? 'border-indigo-500 scale-105' : 'border-zinc-700 opacity-60 hover:opacity-100'}`}
                        >
                            <img src={v} className="w-full h-full object-cover" />
                            <div className="absolute bottom-0 right-0 bg-black/70 text-[8px] text-white px-1 font-bold">
                                V{idx + 1}
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        )}

        {/* Refinement Bar (Hidden for Community Items) */}
        {!isCommunityItem && (
            <div className="px-4 mb-4">
                <form onSubmit={handleRefine} className="relative flex items-center">
                    <div className="absolute left-3 text-indigo-400">
                        <Sparkles size={18} />
                    </div>
                    <input 
                        type="text" 
                        value={promptInput}
                        onChange={(e) => setPromptInput(e.target.value)}
                        placeholder="Describe changes (e.g. 'Make it darker')" 
                        className="w-full bg-zinc-800/80 border border-zinc-700 rounded-xl py-3 pl-10 pr-12 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all backdrop-blur-sm"
                        disabled={isRefining}
                    />
                    <button 
                        type="submit" 
                        disabled={!promptInput.trim() || isRefining}
                        className="absolute right-2 p-1.5 bg-indigo-600 rounded-lg text-white disabled:opacity-50 disabled:bg-zinc-700 transition-all hover:bg-indigo-500 active:scale-95"
                    >
                        <Send size={16} />
                    </button>
                </form>
            </div>
        )}

        {/* Action Buttons */}
        <div className="px-4 pb-[calc(env(safe-area-inset-bottom)+20px)] space-y-4">
            {isCommunityItem ? (
                /* Community Actions */
                <div className="flex flex-row gap-4">
                    {initialResult.layers && initialResult.productId && (
                        <Button onClick={handleRemix} className="flex-1" icon={<Copy size={18} />}>
                            Remix Design
                        </Button>
                    )}
                    <Button 
                        variant="secondary" 
                        onClick={() => {
                             const link = document.createElement('a');
                             link.href = currentImageUrl;
                             
                             // Detect ext
                             const mime = currentImageUrl.match(/data:([^;]+);/)?.[1] || 'image/png';
                             const ext = mime === 'image/jpeg' ? 'jpg' : 'png';
                             
                             link.download = `foundry-remix-${Date.now()}.${ext}`;
                             link.click();
                             showToast("Download Started");
                        }} 
                        className="flex-1" 
                        icon={<Download size={18} />}
                    >
                        Download
                    </Button>
                </div>
            ) : (
                /* Owner Actions */
                <div className="flex flex-col gap-3">
                    <div className="flex flex-row gap-4">
                        <Button variant="secondary" onClick={handleSave} className="flex-1" icon={<Package size={18} />}>
                            Save V{selectedVersionIndex + 1}
                        </Button>
                        <Button 
                            onClick={handleShare} 
                            variant="secondary" 
                            className="flex-1" 
                            icon={<Send size={18} />}
                        >
                            Share
                        </Button>
                        <Button 
                            onClick={handlePublish} 
                            disabled={isPublishing}
                            variant="outline"
                            className="flex-1 border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/10" 
                            icon={isPublishing ? <LoadingSpinner size={18} color="text-indigo-300"/> : <Globe size={18} />}
                        >
                            Publish
                        </Button>
                    </div>
                    {/* Delete Option (Low Key) */}
                    <button 
                        onClick={handleDelete}
                        className="w-full py-2 text-zinc-600 text-xs font-bold uppercase tracking-wider hover:text-red-500 transition-colors flex items-center justify-center gap-2"
                    >
                        <Trash2 size={12} /> Delete All Versions
                    </button>
                </div>
            )}
        </div>
      </div>
      
      <style>{`
        @keyframes scan {
            0% { transform: translateY(-100%); }
            100% { transform: translateY(100%); }
        }
        .animate-scan {
            animation: scan 2s linear infinite;
        }
      `}</style>
    </div>
  );
};