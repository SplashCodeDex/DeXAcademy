/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, RefObject, useRef } from 'react';
import { PlacedLayer } from '../types';

interface GestureState {
  layerId: string;
  type: 'drag' | 'pinch';
  startX: number;
  startY: number;
  startScale: number;
  startRot: number;
  initialLayerX: number;
  initialLayerY: number;
  initialDist: number;
  initialAngle: number;
  hasMoved: boolean; // Track if actual modification occurred
}

export const useCanvasGestures = (
  canvasRef: RefObject<HTMLDivElement>,
  layers: PlacedLayer[],
  setLayers: (layers: PlacedLayer[]) => void,
  activeLayerId: string | null,
  setActiveLayerId: (id: string | null) => void,
  isProcessing: boolean,
  commitHistory: (layers: PlacedLayer[]) => void
) => {
  const [gesture, setGesture] = useState<GestureState | null>(null);
  const wheelCommitTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getDist = (t1: React.Touch, t2: React.Touch) => 
    Math.sqrt(Math.pow(t1.clientX - t2.clientX, 2) + Math.pow(t1.clientY - t2.clientY, 2));
  
  const getAngle = (t1: React.Touch, t2: React.Touch) => 
    Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX) * 180 / Math.PI;

  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent, layerId: string) => {
    if (isProcessing) return;
    e.stopPropagation();
    setActiveLayerId(layerId);
    
    const layer = layers.find(l => l.uid === layerId);
    if (!layer || !canvasRef.current) return;

    const isTouch = 'touches' in e;
    
    if (isTouch && (e as React.TouchEvent).touches.length === 2) {
      const t1 = (e as React.TouchEvent).touches[0];
      const t2 = (e as React.TouchEvent).touches[1];
      setGesture({
        layerId,
        type: 'pinch',
        startX: 0, startY: 0,
        startScale: layer.scale,
        startRot: layer.rotation,
        initialLayerX: 0, initialLayerY: 0,
        initialDist: getDist(t1, t2),
        initialAngle: getAngle(t1, t2),
        hasMoved: false
      });
      return;
    }

    const clientX = isTouch ? (e as React.TouchEvent).touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = isTouch ? (e as React.TouchEvent).touches[0].clientY : (e as React.MouseEvent).clientY;

    setGesture({
      layerId,
      type: 'drag',
      startX: clientX,
      startY: clientY,
      startScale: layer.scale,
      startRot: layer.rotation,
      initialLayerX: layer.x,
      initialLayerY: layer.y,
      initialDist: 0,
      initialAngle: 0,
      hasMoved: false
    });
  };

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!gesture || !canvasRef.current || isProcessing) return;
    
    // Only prevent default for mouse events. 
    // For touch, we rely on CSS `touch-action: none` to prevent scrolling.
    if (!('touches' in e)) {
        e.preventDefault(); 
    }

    // Mark as moved so we know to commit history on release
    if (!gesture.hasMoved) {
        setGesture(prev => prev ? ({ ...prev, hasMoved: true }) : null);
    }

    const rect = canvasRef.current.getBoundingClientRect();
    const isTouch = 'touches' in e;

    if (gesture.type === 'pinch' && isTouch && (e as React.TouchEvent).touches.length === 2) {
       const t1 = (e as React.TouchEvent).touches[0];
       const t2 = (e as React.TouchEvent).touches[1];
       const dist = getDist(t1, t2);
       const angle = getAngle(t1, t2);
       const scaleRatio = dist / gesture.initialDist;
       const angleDelta = angle - gesture.initialAngle;

       const newLayers = layers.map(l => l.uid === gesture.layerId ? {
          ...l,
          scale: Math.max(0.1, Math.min(5, gesture.startScale * scaleRatio)),
          rotation: (gesture.startRot + angleDelta) % 360
       } : l);
       setLayers(newLayers);
       return;
    }

    if (gesture.type === 'drag') {
       const clientX = isTouch ? (e as React.TouchEvent).touches[0].clientX : (e as React.MouseEvent).clientX;
       const clientY = isTouch ? (e as React.TouchEvent).touches[0].clientY : (e as React.MouseEvent).clientY;
       const deltaXPixels = clientX - gesture.startX;
       const deltaYPixels = clientY - gesture.startY;
       const deltaXPercent = (deltaXPixels / rect.width) * 100;
       const deltaYPercent = (deltaYPixels / rect.height) * 100;

       const newLayers = layers.map(l => l.uid === gesture.layerId ? {
          ...l,
          x: Math.max(0, Math.min(100, gesture.initialLayerX + deltaXPercent)),
          y: Math.max(0, Math.min(100, gesture.initialLayerY + deltaYPercent))
       } : l);
       setLayers(newLayers);
    }
  };

  const handleUp = () => {
    if (gesture) {
      // Only commit if the layer was actually manipulated
      if (gesture.hasMoved) {
        commitHistory(layers);
      }
      setGesture(null);
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (!activeLayerId || isProcessing) return;
    const layer = layers.find(l => l.uid === activeLayerId);
    if (!layer) return;
    
    // Normalize delta to -1 or 1 to handle different mouse wheels (pixels vs lines)
    // -0.1 means 10% increment/decrement per notch
    const delta = Math.sign(e.deltaY) * -0.1;
    
    const newScale = Math.max(0.1, Math.min(5, layer.scale + delta));
    const newLayers = layers.map(l => l.uid === activeLayerId ? { ...l, scale: newScale } : l);
    
    setLayers(newLayers);

    // Debounce the commit so we don't spam history during scrolling
    if (wheelCommitTimeout.current) clearTimeout(wheelCommitTimeout.current);
    wheelCommitTimeout.current = setTimeout(() => {
        commitHistory(newLayers);
    }, 500);
  };

  return {
    handlePointerDown,
    handleMove,
    handleUp,
    handleWheel
  };
};