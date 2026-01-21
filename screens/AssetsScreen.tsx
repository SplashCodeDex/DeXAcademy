/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, Wallet, Plus, Sparkles, Trash2, ArrowRight, Wand2, X, BrainCircuit } from 'lucide-react';
import { NativeStackScreenProps } from '../components/Navigation';
import { useGlobalState } from '../context/GlobalStateContext';
import { useApiKey } from '../hooks/useApiKey';
import { useToast } from '../context/ToastContext';
import { Header } from '../components/Header';
import { Button } from '../components/Button';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { Haptics, NotificationFeedbackType } from '../lib/haptics';
import { launchImageLibraryAsync } from '../lib/imagePicker';
import { generateAsset, removeBackground, analyzeAsset } from '../services/geminiService';
import { generateId } from '../lib/utils';
import { Asset } from '../types';

export const AssetsScreen = ({ navigation }: NativeStackScreenProps<any, 'Assets'>) => {
  const { assets, addAsset, removeAsset, spendCredits, addCredits, clearDraft } = useGlobalState();
  const { validateApiKey } = useApiKey();
  const { showToast } = useToast();
  
  const [activeTab, setActiveTab] = useState<'product' | 'logo'>('product');
  const [isGenerating, setIsGenerating] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  
  // Prompt Modal State
  const [showPromptModal, setShowPromptModal] = useState(false);
  const [promptText, setPromptText] = useState('');

  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const handlePickImage = async () => {
    const result = await launchImageLibraryAsync({ mediaTypes: 'Images' });
    if (!result.canceled && result.assets) {
      const rawAsset = result.assets[0];
      const tempId = generateId();
      
      // 1. Optimistic Add (Show immediately as "Analyzing...")
      addAsset({
        id: tempId,
        type: activeTab, 
        name: 'Analyzing...', 
        data: rawAsset.base64 || rawAsset.uri,
        mimeType: rawAsset.mimeType || 'image/png'
      });
      
      setProcessingId(tempId);
      
      try {
          if (!(await validateApiKey())) {
              // Fallback if no API key
              addAsset({
                  id: tempId,
                  type: activeTab,
                  name: rawAsset.fileName || 'Upload',
                  data: rawAsset.base64 || rawAsset.uri,
                  mimeType: rawAsset.mimeType || 'image/png'
              });
              return;
          }

          // 2. Analyze with Gemini
          const analysis = await analyzeAsset(rawAsset.base64 || rawAsset.uri);
          
          if (!isMounted.current) return;

          // 3. Update with AI insights
          // We remove the temp one and add the analyzed one (simulated update via replace)
          removeAsset(tempId);
          addAsset({
              id: tempId, // Keep same ID
              type: analysis.type, // Use detected type
              name: analysis.name, // Use AI name
              data: rawAsset.base64 || rawAsset.uri,
              mimeType: rawAsset.mimeType || 'image/png'
          });
          
          showToast(`Identified: ${analysis.name}`);
          
          // Switch tab if AI detected a different type
          if (analysis.type !== activeTab) {
              setActiveTab(analysis.type as any);
          }

      } catch (e) {
          console.error("Analysis failed", e);
          // Fallback update
          removeAsset(tempId);
          addAsset({
              id: tempId,
              type: activeTab,
              name: rawAsset.fileName || 'Upload',
              data: rawAsset.base64 || rawAsset.uri,
              mimeType: rawAsset.mimeType || 'image/png'
          });
      } finally {
          if (isMounted.current) setProcessingId(null);
      }
    }
  };

  const handleError = (e: unknown, fallbackMessage: string) => {
     addCredits(1);
     Haptics.notificationAsync(NotificationFeedbackType.Error);
     
     let msg = "";
     if (e instanceof Error) {
         msg = e.message.toLowerCase();
     } else {
         msg = String(e).toLowerCase();
     }
     
     if (msg.includes('safety') || msg.includes('blocked')) {
         showToast("Blocked: Safety filters triggered", 'error');
     } else if (msg.includes('exhausted')) {
         showToast("System Busy: Try again later", 'error');
     } else {
         showToast(fallbackMessage, 'error');
     }
  };

  const executeGenerate = async () => {
    setShowPromptModal(false);
    if (!promptText.trim()) return;

    if (!spendCredits(1)) {
        showToast("Insufficient Credits", 'error');
        navigation.navigate('Store');
        return;
    }
    
    if (!(await validateApiKey())) {
        addCredits(1);
        return;
    }

    setIsGenerating(true);
    try {
      const b64 = await generateAsset(promptText, activeTab);
      if (!isMounted.current) return;

      // Detect mime type from header
      const mimeMatch = b64.match(/data:(.*?);base64/);
      const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';

      addAsset({
        id: generateId(),
        type: activeTab,
        name: `AI ${activeTab}`,
        data: b64,
        mimeType: mimeType
      });
      showToast("Generated Successfully");
      setPromptText('');
    } catch (e) {
      if (isMounted.current) handleError(e, 'Generation Failed');
    } finally {
      if (isMounted.current) setIsGenerating(false);
    }
  };

  const handleRemoveBackground = async (asset: Asset) => {
    if (!spendCredits(1)) {
        showToast("Insufficient Credits", 'error');
        navigation.navigate('Store');
        return;
    }

    if (!(await validateApiKey())) {
        addCredits(1);
        return;
    }

    setProcessingId(asset.id);
    try {
        const newImage = await removeBackground(asset.data);
        if (!isMounted.current) return;

        const mimeMatch = newImage.match(/data:(.*?);base64/);
        const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';

        addAsset({
            id: generateId(),
            type: asset.type,
            name: `No BG - ${asset.name}`,
            data: newImage,
            mimeType: mimeType
        });
        showToast("Background Removed");
    } catch (e) {
        if (isMounted.current) handleError(e, 'Background Removal Failed');
    } finally {
        if (isMounted.current) setProcessingId(null);
    }
  };

  const filteredAssets = assets.filter(a => a.type === activeTab);

  return (
    <div className="bg-black flex-1 flex flex-col h-full relative">
      <Header 
        title="Assets Library" 
        leftAction={{ icon: <ChevronLeft />, onPress: navigation.goBack }} 
        rightAction={{ icon: <Wallet size={20} className="text-indigo-400" />, onPress: () => navigation.navigate('Store') }}
      />

      {showPromptModal && (
          <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 animate-fade-in">
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-slide-up">
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="text-white font-bold text-lg">Generate {activeTab === 'product' ? 'Product' : 'Logo'}</h3>
                      <button onClick={() => setShowPromptModal(false)} className="text-zinc-500 hover:text-white"><X size={20} /></button>
                  </div>
                  <textarea 
                    autoFocus
                    value={promptText}
                    onChange={(e) => setPromptText(e.target.value)}
                    placeholder={`Describe your ${activeTab}...`}
                    className="w-full h-32 bg-black/50 border border-zinc-700 rounded-xl p-3 text-white mb-4 focus:border-indigo-500 outline-none resize-none"
                  />
                  <div className="flex gap-3">
                      <Button variant="secondary" onClick={() => setShowPromptModal(false)} className="flex-1">Cancel</Button>
                      <Button onClick={executeGenerate} className="flex-1" icon={<Sparkles size={16} />}>
                          Generate (1)
                      </Button>
                  </div>
              </div>
          </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 pb-24">
        <div className="flex flex-row gap-4 py-4 sticky top-0 bg-black/80 backdrop-blur-md z-10">
            <button 
            onClick={() => { Haptics.selectionAsync(); setActiveTab('product'); }}
            className={`flex-1 py-3 rounded-lg flex items-center justify-center transition-colors ${activeTab === 'product' ? 'bg-indigo-600' : 'bg-zinc-900'}`}
            >
            <span className={`font-bold ${activeTab === 'product' ? 'text-white' : 'text-zinc-400'}`}>Products</span>
            </button>
            <button 
            onClick={() => { Haptics.selectionAsync(); setActiveTab('logo'); }}
            className={`flex-1 py-3 rounded-lg flex items-center justify-center transition-colors ${activeTab === 'logo' ? 'bg-indigo-600' : 'bg-zinc-900'}`}
            >
            <span className={`font-bold ${activeTab === 'logo' ? 'text-white' : 'text-zinc-400'}`}>Logos</span>
            </button>
        </div>

        <div className="flex flex-row flex-wrap justify-between">
          <button 
            onClick={handlePickImage}
            className="w-[48%] aspect-square bg-zinc-900 rounded-xl border-2 border-dashed border-zinc-700 flex flex-col items-center justify-center mb-4 active:bg-zinc-800"
          >
            <Plus size={32} className="text-zinc-500 mb-2" />
            <span className="text-zinc-500 text-sm">Upload</span>
          </button>
          
          <button 
            onClick={() => setShowPromptModal(true)}
            disabled={isGenerating}
            className="w-[48%] aspect-square bg-zinc-900 rounded-xl border-2 border-dashed border-zinc-700 flex flex-col items-center justify-center mb-4 active:bg-zinc-800"
          >
             {isGenerating ? <LoadingSpinner color="text-amber-500" /> : (
               <>
                 <Sparkles size={32} className="text-amber-500 mb-2" />
                 <span className="text-amber-500 text-sm">Generate AI</span>
                 <span className="text-zinc-600 text-xs mt-1">1 Credit</span>
               </>
             )}
          </button>

          {filteredAssets.map(asset => (
            <div key={asset.id} className="w-[48%] aspect-square bg-zinc-800 rounded-xl overflow-hidden mb-4 relative group">
              <div className="absolute inset-0 pattern-grid opacity-20 pointer-events-none" />
              <img src={asset.data} className="w-full h-full object-contain pointer-events-none relative z-0" />
              
              {/* Processing Overlay */}
              {processingId === asset.id && (
                  <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center z-20 backdrop-blur-sm">
                       <BrainCircuit size={24} className="text-indigo-400 animate-pulse mb-2" />
                       <span className="text-[10px] text-white font-mono uppercase tracking-widest">Analyzing...</span>
                  </div>
              )}

              <div className="absolute top-1 right-1 flex flex-col gap-1 z-10">
                   <button 
                    onClick={() => removeAsset(asset.id)}
                    className="bg-black/60 p-2 rounded-full hover:bg-red-500 transition-colors backdrop-blur-md border border-white/10"
                  >
                    <Trash2 size={14} className="text-white" />
                  </button>
                  
                   <button 
                    onClick={() => handleRemoveBackground(asset)}
                    disabled={processingId === asset.id}
                    className="bg-black/60 p-2 rounded-full hover:bg-indigo-500 transition-colors backdrop-blur-md border border-white/10"
                  >
                    <Wand2 size={14} className="text-white" />
                  </button>
              </div>
              
              <div className="absolute bottom-0 left-0 right-0 p-1.5 bg-gradient-to-t from-black/90 to-transparent">
                  <p className="text-white text-[10px] font-bold truncate px-1">{asset.name}</p>
              </div>

              {asset.name.includes('No BG') && (
                  <div className="absolute top-1 left-1 bg-green-500/80 backdrop-blur-sm px-1.5 py-0.5 rounded text-[10px] font-bold uppercase text-white z-10">
                      No BG
                  </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 bg-zinc-950/90 border-t border-zinc-800 p-4 pb-[calc(env(safe-area-inset-bottom)+20px)] backdrop-blur-md">
        <Button 
          onClick={() => { clearDraft(); navigation.navigate('Studio'); }} 
          disabled={assets.filter(a => a.type === 'product').length === 0}
          icon={<ArrowRight size={20} />}
          className="w-full"
        >
          Start New Studio Project
        </Button>
      </div>
    </div>
  );
};