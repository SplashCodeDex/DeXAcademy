/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, SwitchCamera, ScanLine, X } from 'lucide-react';
import { NativeStackScreenProps } from '../components/Navigation';
import { useGlobalState } from '../context/GlobalStateContext';
import { useApiKey } from '../hooks/useApiKey';
import { useToast } from '../context/ToastContext';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { generateRealtimeComposite } from '../services/geminiService';
import { generateId } from '../lib/utils';
import { Haptics, NotificationFeedbackType } from '../lib/haptics';
import { useCanvasGestures } from '../hooks/useCanvasGestures';
import { PlacedLayer } from '../types';

export const TryOnScreen = ({ navigation }: NativeStackScreenProps<any, 'TryOn'>) => {
  const { assets, spendCredits, addCredits } = useGlobalState();
  const { validateApiKey } = useApiKey();
  const { showToast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Track mount state to prevent memory leaks if user backs out during init
  const streamRef = useRef<MediaStream | null>(null);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [layers, setLayers] = useState<PlacedLayer[]>([]);
  const [activeLayerId, setActiveLayerId] = useState<string | null>(null);

  const { handlePointerDown, handleMove, handleUp, handleWheel } = useCanvasGestures(
    containerRef,
    layers,
    setLayers,
    activeLayerId,
    setActiveLayerId,
    isProcessing,
    () => {} 
  );

  const stopCamera = () => {
    if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
    }
    if (videoRef.current) {
        videoRef.current.srcObject = null;
    }
  };

  const startCamera = async () => {
    try {
        stopCamera();

        // Constraints
        const constraints = {
            video: {
                facingMode: facingMode,
                width: { ideal: 1280 },
                height: { ideal: 720 }
            },
            audio: false
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        
        streamRef.current = stream;
        if (videoRef.current) {
            videoRef.current.srcObject = stream;
            // iOS requires play() to be called explicitly sometimes
            videoRef.current.play().catch(e => console.log("Play error", e));
        }
    } catch (e) {
        console.error("Camera Error", e);
        showToast("Camera access denied", 'error');
    }
  };

  useEffect(() => {
    startCamera();

    const handleVisibilityChange = () => {
        if (document.hidden) {
            stopCamera();
        } else {
            startCamera();
        }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
        stopCamera();
        document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [facingMode]);

  const handleCapture = async () => {
      if (!videoRef.current || !containerRef.current || isProcessing) return;
      if (layers.length === 0) {
          showToast("Add an asset to place first", 'info');
          return;
      }
      
      if (!spendCredits(1)) {
          showToast("Insufficient Credits", 'error');
          return;
      }

      if (!(await validateApiKey())) {
          addCredits(1);
          return;
      }

      setIsProcessing(true);
      Haptics.notificationAsync(NotificationFeedbackType.Success);

      try {
          const video = videoRef.current;
          const container = containerRef.current;
          const canvas = document.createElement('canvas');
          
          // --- WYSIWYG Calculation ---
          // Determine the actual visible crop of the video to match what the user sees
          const vidW = video.videoWidth;
          const vidH = video.videoHeight;
          const screenW = container.clientWidth;
          const screenH = container.clientHeight;
          
          const screenAspect = screenW / screenH;
          const vidAspect = vidW / vidH;
          
          let sx = 0, sy = 0, sWidth = vidW, sHeight = vidH;
          
          if (screenAspect > vidAspect) {
              // Screen is wider than video (video cropped vertically - top/bottom cut off)
              // Actually, object-cover fills the container.
              // If screen is wider, we scale video width to match screen width. Height gets cropped?
              // Wait:
              // If screen is wider (2:1) than video (1:1), video is zoomed to fill width. Top/bottom cropped.
              // Source crop height = vidW / screenAspect.
              sHeight = vidW / screenAspect;
              sy = (vidH - sHeight) / 2;
          } else {
              // Screen is taller than video (video cropped horizontally - sides cut off)
              // This is the common mobile case (portrait phone, landscape camera sensor).
              sWidth = vidH * screenAspect;
              sx = (vidW - sWidth) / 2;
          }
          
          // Set canvas to match the screen's aspect ratio (but higher res)
          // We limit max dimension to 1280 for performance/tokens
          const MAX_DIM = 1280;
          const scale = Math.min(1, MAX_DIM / Math.max(sWidth, sHeight));
          
          canvas.width = sWidth * scale;
          canvas.height = sHeight * scale;
          
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error("No Context");

          // Draw the CROPPED video frame
          ctx.drawImage(video, sx, sy, sWidth, sHeight, 0, 0, canvas.width, canvas.height);
          
          // Draw Layers
          // Now coordinates (0-100%) map perfectly to the canvas dimensions because the canvas
          // represents exactly the visible viewport.
          await Promise.all(layers.map(async (layer) => {
               const asset = assets.find(a => a.id === layer.assetId);
               if (!asset) return;
               
               const img = new Image();
               img.src = asset.data;
               await new Promise((r) => { img.onload = r; img.onerror = r; }); // Wait for load
               
               const x = (layer.x / 100) * canvas.width;
               const y = (layer.y / 100) * canvas.height;
               
               // Scale is relative to viewport width (25% baseline)
               const baseSize = canvas.width * 0.25;
               const w = baseSize * layer.scale;
               const h = w * (img.height / img.width); 
               
               ctx.save();
               ctx.translate(x, y);
               ctx.rotate((layer.rotation * Math.PI) / 180);
               ctx.drawImage(img, -w/2, -h/2, w, h);
               ctx.restore();
          }));

          const compositeB64 = canvas.toDataURL('image/jpeg', 0.85);
          
          const resultUrl = await generateRealtimeComposite(compositeB64, "Make this look photorealistic. Fix lighting and shadows.");
          
          navigation.navigate('Result', { 
              result: { 
                  id: generateId(), 
                  imageUrl: resultUrl, 
                  prompt: "AR Try-On Composite", 
                  createdAt: Date.now() 
              } 
          });

      } catch (e) {
          console.error(e);
          addCredits(1);
          showToast("Capture failed", 'error');
      } finally {
          setIsProcessing(false);
      }
  };

  return (
    <div className="bg-black flex-1 flex flex-col h-full relative overflow-hidden">
        {/* Camera Feed */}
        <div 
            ref={containerRef}
            className="absolute inset-0 z-0 bg-zinc-900"
            onMouseDown={() => setActiveLayerId(null)}
            onTouchStart={() => setActiveLayerId(null)}
            onMouseMove={handleMove}
            onMouseUp={handleUp}
            onTouchMove={handleMove}
            onTouchEnd={handleUp}
            onWheel={handleWheel}
        >
             <video 
                ref={videoRef}
                autoPlay 
                playsInline 
                muted 
                className="w-full h-full object-cover"
             />

             {/* Overlays */}
             {layers.map(layer => {
                 const asset = assets.find(a => a.id === layer.assetId);
                 if (!asset) return null;
                 return (
                     <div 
                        key={layer.uid}
                        onMouseDown={(e) => handlePointerDown(e, layer.uid)}
                        onTouchStart={(e) => handlePointerDown(e, layer.uid)}
                        className={`absolute w-32 h-32 cursor-move ${activeLayerId === layer.uid ? 'ring-2 ring-indigo-500 border-2 border-white/50' : ''}`}
                        style={{
                            left: `${layer.x}%`, top: `${layer.y}%`,
                            transform: `translate(-50%, -50%) scale(${layer.scale}) rotate(${layer.rotation}deg)`,
                            touchAction: 'none'
                        }}
                     >
                         <img src={asset.data} className="w-full h-full object-contain pointer-events-none select-none" />
                     </div>
                 )
             })}
        </div>

        {/* UI Overlay */}
        <div className="absolute top-0 left-0 right-0 z-10 p-4 flex justify-between items-start bg-gradient-to-b from-black/60 to-transparent pt-[calc(env(safe-area-inset-top)+20px)]">
            <button onClick={() => navigation.goBack()} className="p-2 bg-black/40 rounded-full text-white backdrop-blur-md">
                <ChevronLeft />
            </button>
            <div className="flex gap-2">
                <button onClick={() => setFacingMode(m => m === 'user' ? 'environment' : 'user')} className="p-2 bg-black/40 rounded-full text-white backdrop-blur-md">
                    <SwitchCamera />
                </button>
            </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 z-10 p-6 pb-[calc(env(safe-area-inset-bottom)+30px)] flex flex-col items-center bg-gradient-to-t from-black/80 to-transparent">
             
             {/* Asset Picker (Mini) */}
             <div className="w-full overflow-x-auto mb-6 scrollbar-hide">
                 <div className="flex gap-3 px-2">
                     {assets.map(a => (
                         <button 
                            key={a.id}
                            onClick={() => {
                                const newLayer: PlacedLayer = { 
                                    uid: generateId(), 
                                    assetId: a.id, 
                                    x: 50, y: 50, scale: 1, rotation: 0 
                                };
                                setLayers([...layers, newLayer]);
                                setActiveLayerId(newLayer.uid);
                            }}
                            className="w-12 h-12 rounded-lg bg-black/40 border border-white/20 p-1 flex-shrink-0"
                         >
                             <img src={a.data} className="w-full h-full object-contain" />
                         </button>
                     ))}
                 </div>
             </div>

             {/* Capture Button */}
             <button 
                onClick={handleCapture}
                disabled={isProcessing}
                className="w-20 h-20 rounded-full border-4 border-white/30 flex items-center justify-center relative group active:scale-95 transition-all"
             >
                 <div className="w-16 h-16 bg-white rounded-full group-hover:scale-90 transition-transform" />
                 {isProcessing && (
                     <div className="absolute inset-0 flex items-center justify-center">
                         <LoadingSpinner color="text-indigo-600" size={32} />
                     </div>
                 )}
             </button>
        </div>
    </div>
  );
};