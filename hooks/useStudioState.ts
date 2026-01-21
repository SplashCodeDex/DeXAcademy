/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { useState, useCallback, useMemo } from 'react';
import { PlacedLayer, Asset } from '../types';
import { generateId } from '../lib/utils';

export const useStudioState = (initialLayers: PlacedLayer[] = []) => {
    const [layers, setLayers] = useState<PlacedLayer[]>(initialLayers);
    const [activeLayerId, setActiveLayerId] = useState<string | null>(null);
    
    // History Stack
    const [history, setHistory] = useState<PlacedLayer[][]>([initialLayers]);
    const [historyIndex, setHistoryIndex] = useState(0);

    const activeLayer = useMemo(() => 
        layers.find(l => l.uid === activeLayerId) || null
    , [layers, activeLayerId]);

    // --- History Actions ---

    const commit = useCallback((newLayers: PlacedLayer[]) => {
        setLayers(newLayers);
        // Truncate future if we are in the middle of history
        const nextHistory = history.slice(0, historyIndex + 1);
        nextHistory.push(newLayers);
        
        // Optional: Limit history size
        if (nextHistory.length > 20) nextHistory.shift();
        
        setHistory(nextHistory);
        setHistoryIndex(nextHistory.length - 1);
    }, [history, historyIndex]);

    const undo = useCallback(() => {
        if (historyIndex > 0) {
            const prevIndex = historyIndex - 1;
            setHistoryIndex(prevIndex);
            
            const prevLayers = history[prevIndex];
            setLayers(prevLayers);

            // Smart Selection Restore:
            // If the currently selected layer still exists in the past state, keep it selected.
            // If it doesn't exist (e.g. we undid a creation), it naturally deselects if we don't clear.
            // But if we deselect explicitly, we annoy users who just undid a move.
            if (activeLayerId) {
                const stillExists = prevLayers.some(l => l.uid === activeLayerId);
                if (!stillExists) setActiveLayerId(null);
            }
        }
    }, [history, historyIndex, activeLayerId]);

    const redo = useCallback(() => {
        if (historyIndex < history.length - 1) {
            const nextIndex = historyIndex + 1;
            setHistoryIndex(nextIndex);
            
            const nextLayers = history[nextIndex];
            setLayers(nextLayers);
            
            if (activeLayerId) {
                const stillExists = nextLayers.some(l => l.uid === activeLayerId);
                if (!stillExists) setActiveLayerId(null);
            }
        }
    }, [history, historyIndex, activeLayerId]);

    // --- Layer Actions ---

    const addLayer = useCallback((assetId: string) => {
        const newLayer: PlacedLayer = { 
            uid: generateId(), 
            assetId, 
            x: 50, 
            y: 50, 
            scale: 1, 
            rotation: 0,
            blendMode: 'normal'
        };
        const newLayers = [...layers, newLayer];
        commit(newLayers);
        setActiveLayerId(newLayer.uid);
    }, [layers, commit]);

    const updateLayer = useCallback((id: string, updates: Partial<PlacedLayer>) => {
        const newLayers = layers.map(l => l.uid === id ? { ...l, ...updates } : l);
        // Note: We don't commit to history on every drag frame, 
        // typically commit happens on 'mouseUp' via the gesture handler.
        // For direct property edits (sliders), we might want to debounce or commit.
        setLayers(newLayers); 
    }, [layers]);

    // Used for property sliders to ensure history is saved after adjustment
    const commitUpdate = useCallback((id: string, updates: Partial<PlacedLayer>) => {
        const newLayers = layers.map(l => l.uid === id ? { ...l, ...updates } : l);
        commit(newLayers);
    }, [layers, commit]);

    const removeLayer = useCallback((id: string) => {
        const newLayers = layers.filter(l => l.uid !== id);
        commit(newLayers);
        if (activeLayerId === id) setActiveLayerId(null);
    }, [layers, activeLayerId, commit]);

    const reorderLayer = useCallback((id: string, direction: 'forward' | 'backward') => {
        const index = layers.findIndex(l => l.uid === id);
        if (index === -1) return;

        const newLayers = [...layers];
        if (direction === 'backward' && index > 0) {
            [newLayers[index], newLayers[index - 1]] = [newLayers[index - 1], newLayers[index]];
        } else if (direction === 'forward' && index < layers.length - 1) {
            [newLayers[index], newLayers[index + 1]] = [newLayers[index + 1], newLayers[index]];
        }
        
        // Only commit if changed
        if (newLayers[index] !== layers[index]) {
            commit(newLayers);
        }
    }, [layers, commit]);

    const clearCanvas = useCallback(() => {
        commit([]);
        setActiveLayerId(null);
    }, [commit]);

    return {
        layers,
        activeLayerId,
        activeLayer,
        setActiveLayerId,
        setLayers, // For raw gesture updates
        
        // Actions
        addLayer,
        updateLayer,
        commitUpdate,
        removeLayer,
        reorderLayer,
        clearCanvas,

        // History
        commit,
        undo,
        redo,
        canUndo: historyIndex > 0,
        canRedo: historyIndex < history.length - 1
    };
};