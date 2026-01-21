/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, Eraser, Plus, Wand2, Undo, Redo, Sparkles, Command } from 'lucide-react';
import { NativeStackScreenProps } from '../components/Navigation';
import { useGlobalState } from '../context/GlobalStateContext';
import { useApiKey } from '../hooks/useApiKey';
import { useStudioState } from '../hooks/useStudioState';
import { useToast } from '../context/ToastContext';
import { Header } from '../components/Header';
import { Button } from '../components/Button';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { LayerControls } from '../components/LayerControls';
import { AICommandBar } from '../components/AICommandBar';
import { Haptics, NotificationFeedbackType } from '../lib/haptics';
import { audio } from '../lib/audio';
import { generateMockup, interpretStudioCommand } from '../services/geminiService';
import { generateId } from '../lib/utils';
import { useCanvasGestures } from '../hooks/useCanvasGestures';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';

export const StudioScreen = ({ navigation }: NativeStackScreenProps<any, 'Studio'>) => {
  const { assets, spendCredits, addCredits, draft, updateDraft, clearDraft: clearGlobalDraft } = useGlobalState();
  const { validateApiKey } = useApiKey();
  const { showToast } = useToast();
  
  const [selectedProduct, setSelectedProduct] = useState<string | null>(draft?.productId || null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showCommandBar, setShowCommandBar] = useState(false);
  const [isAiCommanding, setIsAiCommanding] = useState(false);
  const [showShortcutsHint, setShowShortcutsHint] = useState(false);
  
  const {
      layers,
      activeLayerId,
      activeLayer,
      setActiveLayerId,
      setLayers, 
      addLayer,
      updateLayer,
      removeLayer,
      reorderLayer,
      clearCanvas,
      commit,
      undo,
      redo,
      canUndo,
      canRedo
  } = useStudioState(draft?.layers || []);

  const canvasRef = useRef<HTMLDivElement>(null);
  const draftUpdateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-select first product if none selected (handles async asset loading)
  useEffect(() => {
    if (!selectedProduct && assets.length > 0) {
        const firstProduct = assets.find(a => a.type === 'product');
        if (firstProduct) setSelectedProduct(firstProduct.id);
    }
  }, [assets, selectedProduct]);

  // Garbage Collection: Clean up layers pointing to deleted assets
  useEffect(() => {
    if (layers.length > 0) {
        const validLayers = layers.filter(l => assets.some(a => a.id === l.assetId));
        if (validLayers.length !== layers.length) {
            setLayers(validLayers);
        }
    }
  }, [assets, layers]);

  // Debounced Draft Sync
  useEffect(() => {
      if (selectedProduct || layers.length > 0) {
          if (draftUpdateTimer.current) clearTimeout(draftUpdateTimer.current);
          draftUpdateTimer.current = setTimeout(() => {
              updateDraft({ productId: selectedProduct, layers: layers });
          }, 1000);
      }
      return () => {
          if (draftUpdateTimer.current) clearTimeout(draftUpdateTimer.current);
      };
  }, [layers, selectedProduct]);

  // Show shortcut hint on mount for desktop users
  useEffect(() => {
    if (window.matchMedia('(pointer: fine)').matches) {
       setShowShortcutsHint(true);
       setTimeout(() => setShowShortcutsHint(false), 5000);
    }
  }, []);

  // --- Pro Features: Keyboard Shortcuts ---
  useKeyboardShortcuts({
      onDelete: () => {
          if (activeLayerId) {
              removeLayer(activeLayerId);
              audio.playClick();
              showToast("Layer Deleted");
          }
      },
      onUndo: () => {
          if (canUndo) {
              undo();
              audio.playClick();
          }
      },
      onRedo: () => {
          if (canRedo) {
              redo();
              audio.playClick();
          }
      },
      onDeselect: () => setActiveLayerId(null),
      onNudge: (dx, dy) => {
          if (activeLayerId) {
              const l = layers.find(l => l.uid === activeLayerId);
              if (l) {
                  updateLayer(activeLayerId, {
                      x: Math.max(0, Math.min(100, l.x + dx)),
                      y: Math.max(0, Math.min(100, l.y + dy))
                  });
              }
          }
      }
  }, !isProcessing && !isAiCommanding);


  const { handlePointerDown, handleMove, handleUp, handleWheel } = useCanvasGestures(
    canvasRef,
    layers,
    setLayers,
    activeLayerId,
    setActiveLayerId,
    isProcessing || isAiCommanding,
    commit
  );

  const handleGenerate = async () => {
    const productAsset = assets.find(a => a.id === selectedProduct);
    if (!productAsset) {
        showToast("Please select a product base", 'error');
        return;
    }

    const validLayers = layers
        .map(l => ({ asset: assets.find(a => a.id === l.assetId), placement: l }))
        .filter(item => item.asset !== undefined) as { asset: any, placement: any }[];

    if (validLayers.length === 0) {
        showToast("Add at least one valid logo/layer", 'error');
        return;
    }

    if (!spendCredits(1)) { showToast("Insufficient Credits", 'error'); audio.playError(); return; }
    if (!(await validateApiKey())) return;

    audio.playClick();
    setIsProcessing(true);
    setActiveLayerId(null);
    
    try {
      const resultUrl = await generateMockup(
          productAsset, 
          validLayers,
          "Create a realistic product mockup."
      );
      
      audio.playSuccess();
      navigation.navigate('Result', { 
        result: { 
            id: generateId(), 
            imageUrl: resultUrl, 
            prompt: "Composite Mockup", 
            createdAt: Date.now(),
            layers: layers,
            productId: selectedProduct || undefined
        }
      });
      showToast("Mockup Generated");
    } catch (e: any) {
      addCredits(1);
      audio.playError();
      Haptics.notificationAsync(NotificationFeedbackType.Error);
      const msg = (e.message || e.toString()).toLowerCase();
      if (msg.includes('safety') || msg.includes('blocked')) {
          showToast("Blocked: Safety filters triggered", 'error');
      } else if (msg.includes('exhausted') || msg.includes('quota')) {
          showToast("System Busy: Try again later", 'error');
      } else {
          showToast("Generation Failed", 'error');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAiCommand = async (command: string) => {
      if (!spendCredits(1)) { showToast("Insufficient Credits", 'error'); return; }
      if (!(await validateApiKey())) { addCredits(1); return; }
      
      setIsAiCommanding(true);
      try {
          const result = await interpretStudioCommand(layers, assets, activeLayerId, command);
          
          if (result.action === 'UPDATE' && result.layerId && result.updates) {
              const newLayers = layers.map(l => l.uid === result.layerId ? { ...l, ...result.updates } : l);
              commit(newLayers);
              audio.playSuccess();
              showToast(result.message);
          } else if (result.action === 'DELETE' && result.layerId) {
              removeLayer(result.layerId);
              audio.playSuccess();
              showToast(result.message);
          } else if (result.action === 'CLEAR') {
              clearCanvas();
              audio.playSuccess();
              showToast(result.message);
          } else {
              audio.playError();
              showToast("Could not understand command", 'info');
          }
      } catch (e) {
          audio.playError();
          addCredits(1);
          console.error(e);
          showToast("AI Command Failed", 'error');
      } finally {
          setIsAiCommanding(false);
          setShowCommandBar(false);
      }
  };

  const handleClear = () => {
      if (confirm("Clear Canvas?")) {
          clearCanvas();
          clearGlobalDraft();
          audio.playSwoosh();
          showToast("Canvas Cleared", 'info');
      }
  };

  return (
    <div className="bg-black flex-1 flex flex-col h-full overflow-hidden">
      <Header 
        title="Studio" 
        leftAction={{ icon: <ChevronLeft />, onPress: () => { audio.playClick(); navigation.goBack(); } }} 
        rightAction={{ 
            icon: <Eraser size={20} className="text-red-400" />, 
            onPress: handleClear
        }}
      />

      {/* Toolbar */}
      <div className="absolute top-16 left-4 z-20 flex gap-2">
         <button 
           onClick={() => { audio.playClick(); undo(); }} 
           disabled={!canUndo}
           className="p-2 bg-zinc-800/80 rounded-full text-white disabled:opacity-30 backdrop-blur-sm border border-white/10"
         >
            <Undo size={16} />
         </button>
         <button 
           onClick={() => { audio.playClick(); redo(); }} 
           disabled={!canRedo}
           className="p-2 bg-zinc-800/80 rounded-full text-white disabled:opacity-30 backdrop-blur-sm border border-white/10"
         >
            <Redo size={16} />
         </button>
         <button 
           onClick={() => { audio.playClick(); setShowCommandBar(!showCommandBar); }} 
           className={`p-2 rounded-full text-white backdrop-blur-sm border border-white/10 transition-all ${showCommandBar ? 'bg-indigo-600' : 'bg-zinc-800/80'}`}
         >
            <Sparkles size={16} className={showCommandBar ? "text-white" : "text-indigo-400"} />
         </button>
      </div>

      {/* Shortcuts Hint Toast */}
      {showShortcutsHint && (
          <div className="absolute top-16 right-4 z-20 bg-zinc-900/90 backdrop-blur text-xs text-zinc-400 px-3 py-2 rounded-lg border border-zinc-800 animate-slide-in-right pointer-events-none">
              <div className="flex items-center gap-2 mb-1"><Command size={10} /> <span>Shortcuts Active</span></div>
              <div className="opacity-75">Arrows to Nudge • Del to Remove</div>
          </div>
      )}
      
      {showCommandBar && (
          <AICommandBar 
             onCommand={handleAiCommand} 
             isProcessing={isAiCommanding} 
             onClose={() => setShowCommandBar(false)} 
          />
      )}

      {/* Main Canvas Area */}
      <div 
        className="flex-1 bg-zinc-950 flex items-center justify-center p-4 relative overflow-hidden"
        onMouseMove={handleMove}
        onMouseUp={handleUp}
        onMouseLeave={handleUp} 
        onTouchMove={handleMove}
        onTouchEnd={handleUp}
      >
         <div 
            ref={canvasRef}
            className={`aspect-square w-full max-w-md bg-zinc-900 relative shadow-2xl rounded overflow-hidden select-none transition-opacity ${isProcessing || isAiCommanding ? 'opacity-50 pointer-events-none' : ''}`}
            onMouseDown={() => !isProcessing && !isAiCommanding && setActiveLayerId(null)}
            onTouchStart={() => !isProcessing && !isAiCommanding && setActiveLayerId(null)}
            onWheel={handleWheel}
         >
             {(isProcessing || isAiCommanding) && (
                <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm">
                    <LoadingSpinner color="text-indigo-400" size={48} />
                    <span className="text-white font-bold mt-4 animate-pulse">
                        {isAiCommanding ? 'Thinking...' : 'Designing...'}
                    </span>
                </div>
             )}

             {selectedProduct && assets.find(a => a.id === selectedProduct) && (
                 <img 
                    src={assets.find(a => a.id === selectedProduct)?.data} 
                    className="w-full h-full object-contain pointer-events-none select-none" 
                    draggable={false}
                 />
             )}

             {layers.map(layer => {
                 const asset = assets.find(a => a.id === layer.assetId);
                 if (!asset) return null;
                 return (
                     <div 
                        key={layer.uid}
                        onMouseDown={(e) => handlePointerDown(e, layer.uid)}
                        onTouchStart={(e) => handlePointerDown(e, layer.uid)}
                        className={`absolute w-24 h-24 cursor-move ${activeLayerId === layer.uid && !isProcessing && !isAiCommanding ? 'ring-2 ring-indigo-500' : ''}`}
                        style={{
                            left: `${layer.x}%`, top: `${layer.y}%`,
                            transform: `translate(-50%, -50%) scale(${layer.scale}) rotate(${layer.rotation}deg)`,
                            mixBlendMode: layer.blendMode || 'normal',
                            touchAction: 'none'
                        }}
                     >
                         <img src={asset.data} className="w-full h-full object-contain pointer-events-none select-none" draggable={false} />
                     </div>
                 )
             })}
         </div>
      </div>

      <div className={`bg-zinc-900 border-t border-zinc-800 pb-[calc(env(safe-area-inset-bottom)+10px)] transition-opacity ${isProcessing || isAiCommanding ? 'opacity-50 pointer-events-none' : ''}`}>
         {activeLayer ? (
             <LayerControls 
                layer={activeLayer}
                onUpdate={(updates) => updateLayer(activeLayer.uid, updates)}
                onCommit={() => commit(layers)}
                onDelete={() => removeLayer(activeLayer.uid)}
                onReorder={(dir) => reorderLayer(activeLayer.uid, dir)}
                onClose={() => setActiveLayerId(null)}
             />
         ) : (
             <div className="h-64 flex flex-col animate-slide-up">
                <div className="flex-1 overflow-x-auto whitespace-nowrap p-4 border-b border-zinc-800">
                    <div className="flex gap-2">
                        {assets.filter(a => a.type === 'product').map(p => (
                            <button key={p.id} onClick={() => { audio.playClick(); setSelectedProduct(p.id); }} className={`inline-block w-16 h-16 rounded-lg border-2 p-1 transition-all ${selectedProduct === p.id ? 'border-indigo-500 scale-105' : 'border-zinc-700 opacity-70 hover:opacity-100'}`}>
                                <img src={p.data} className="w-full h-full object-contain" />
                            </button>
                        ))}
                    </div>
                </div>
                <div className="flex-1 overflow-x-auto whitespace-nowrap p-4 flex items-center">
                    <button onClick={() => { audio.playClick(); navigation.navigate('Assets'); }} className="w-16 h-16 mr-2 rounded-lg border border-dashed border-zinc-600 flex items-center justify-center text-zinc-500 flex-shrink-0 hover:border-zinc-400 hover:text-zinc-300 transition-colors">
                        <Plus />
                    </button>
                    {assets.filter(a => a.type === 'logo').map(l => (
                        <button 
                            key={l.id} 
                            onClick={() => { audio.playClick(); addLayer(l.id); }} 
                            className="inline-block w-16 h-16 mr-2 rounded-lg bg-zinc-800 p-1 flex-shrink-0 border border-zinc-700 hover:border-zinc-500 transition-all active:scale-95"
                        >
                            <img src={l.data} className="w-full h-full object-contain" />
                        </button>
                    ))}
                </div>
             </div>
         )}
         <div className="px-4 pt-2">
            <Button onClick={handleGenerate} isLoading={isProcessing} icon={<Wand2 size={18}/>}>Generate Mockup (1 CR)</Button>
         </div>
      </div>
    </div>
  );
};