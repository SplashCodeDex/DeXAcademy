/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useReducer, useEffect, useContext, PropsWithChildren, useMemo, useCallback, useRef } from 'react';
import { Asset, GeneratedMockup, GlobalContextType, Draft } from '../types';
import { DEMO_ASSETS } from '../lib/constants';
import { Haptics, NotificationFeedbackType } from '../lib/haptics';
import { useAuth } from './AuthContext';
import { FirestoreService } from '../services/firestoreService';

// --- State Definition ---

interface AppState {
    assets: Asset[];
    savedMockups: GeneratedMockup[];
    credits: number;
    draft: Draft | null;
    isSyncing: boolean;
}

const initialState: AppState = {
    assets: [],
    savedMockups: [],
    credits: 3,
    draft: null,
    isSyncing: false,
};

// --- Actions ---

type Action =
    | { type: 'START_SYNC' }
    | { type: 'HYDRATE_SUCCESS'; payload: Partial<AppState> }
    | { type: 'RESET' }
    | { type: 'ADD_ASSET'; payload: Asset }
    | { type: 'REMOVE_ASSET'; payload: string }
    | { type: 'ADD_MOCKUP'; payload: GeneratedMockup }
    | { type: 'REMOVE_MOCKUP'; payload: string }
    | { type: 'SET_CREDITS'; payload: number }
    | { type: 'UPDATE_DRAFT'; payload: Draft | null };

// --- Reducer ---

function appReducer(state: AppState, action: Action): AppState {
    switch (action.type) {
        case 'START_SYNC':
            return { ...state, isSyncing: true };
        case 'HYDRATE_SUCCESS':
            return { ...state, isSyncing: false, ...action.payload };
        case 'RESET':
            return { ...initialState };
        case 'ADD_ASSET':
            return { ...state, assets: [action.payload, ...state.assets] };
        case 'REMOVE_ASSET':
            return { ...state, assets: state.assets.filter(a => a.id !== action.payload) };
        case 'ADD_MOCKUP': {
            // Check for existence to update instead of duplicate
            const exists = state.savedMockups.some(m => m.id === action.payload.id);
            if (exists) {
                return {
                    ...state,
                    savedMockups: state.savedMockups.map(m => m.id === action.payload.id ? action.payload : m)
                };
            }
            return { ...state, savedMockups: [action.payload, ...state.savedMockups] };
        }
        case 'REMOVE_MOCKUP':
            return { ...state, savedMockups: state.savedMockups.filter(m => m.id !== action.payload) };
        case 'SET_CREDITS':
            return { ...state, credits: action.payload };
        case 'UPDATE_DRAFT':
            return { ...state, draft: action.payload };
        default:
            return state;
    }
}

// --- Context ---

interface ExtendedGlobalContextType extends GlobalContextType {
    isSyncing: boolean;
    refreshProfile: () => Promise<void>;
    deleteMockup: (id: string) => Promise<void>;
}

const GlobalStateContext = React.createContext<ExtendedGlobalContextType | null>(null);

export const useGlobalState = () => {
    const context = useContext(GlobalStateContext);
    if (!context) throw new Error("useGlobalState must be used within GlobalStateProvider");
    return context;
};

// --- Provider ---

export const GlobalStateProvider = ({ children }: PropsWithChildren<{}>) => {
    const { user } = useAuth();
    const [state, dispatch] = useReducer(appReducer, initialState);
    
    // Ref to hold the debounce timer
    const draftSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // --- Effects: Sync Logic ---

    useEffect(() => {
        let isMounted = true;

        const hydrateData = async () => {
            if (!user) {
                if (isMounted) dispatch({ type: 'RESET' });
                return;
            }

            if (isMounted) dispatch({ type: 'START_SYNC' });
            
            try {
                const [remoteAssets, remoteMockups, profile, remoteDraft] = await Promise.all([
                    FirestoreService.getAssets(user.uid),
                    FirestoreService.getMockups(user.uid),
                    FirestoreService.getProfile(user.uid),
                    FirestoreService.getDraft(user.uid)
                ]);

                if (isMounted) {
                    dispatch({ 
                        type: 'HYDRATE_SUCCESS', 
                        payload: {
                            assets: remoteAssets,
                            savedMockups: remoteMockups,
                            credits: profile?.credits ?? 3,
                            draft: remoteDraft
                        }
                    });
                }
            } catch (e) {
                console.error("Hydration Failed", e);
                if (isMounted) dispatch({ type: 'HYDRATE_SUCCESS', payload: {} }); // Stop loading state
            }
        };

        hydrateData();

        return () => {
            isMounted = false;
        };
    }, [user]);

    // Force refresh wrapper
    const refreshProfile = useCallback(async () => {
        if (!user) return;
        try {
            const profile = await FirestoreService.getProfile(user.uid);
            dispatch({ type: 'SET_CREDITS', payload: profile?.credits ?? 3 });
        } catch (e) {
            console.error(e);
        }
    }, [user]);

    // --- Action Wrappers (Business Logic) ---
    // Wrapped in useCallback to maintain referential stability

    const addAsset = useCallback(async (a: Asset) => {
        dispatch({ type: 'ADD_ASSET', payload: a });
        if (user) await FirestoreService.saveAsset(user.uid, a);
    }, [user]);

    const removeAsset = useCallback(async (id: string) => {
        // Fix: Clean up drafts that reference this asset to prevent ghost layers
        if (state.draft) {
             const cleanLayers = state.draft.layers.filter(l => l.assetId !== id);
             if (cleanLayers.length !== state.draft.layers.length) {
                 // Update local state immediately
                 dispatch({ type: 'UPDATE_DRAFT', payload: { ...state.draft, layers: cleanLayers } });
                 // If persistence is needed immediately for this edge case:
                 if (user) {
                     await FirestoreService.saveDraft(user.uid, { ...state.draft, layers: cleanLayers });
                 }
             }
        }

        dispatch({ type: 'REMOVE_ASSET', payload: id });
        if (user) await FirestoreService.deleteAsset(user.uid, id);
    }, [user, state.draft]);

    const saveMockup = useCallback(async (m: GeneratedMockup) => {
        dispatch({ type: 'ADD_MOCKUP', payload: m });
        if (user) await FirestoreService.saveMockup(user.uid, m);
    }, [user]);

    const deleteMockup = useCallback(async (id: string) => {
        dispatch({ type: 'REMOVE_MOCKUP', payload: id });
        if (user) await FirestoreService.deleteMockup(user.uid, id);
    }, [user]);

    const updateDraft = useCallback(async (updates: Partial<Draft>) => {
        // 1. Update In-Memory State Immediately (UI Responsiveness)
        const updated: Draft = {
            productId: updates.productId !== undefined ? updates.productId : (state.draft?.productId || null),
            layers: updates.layers !== undefined ? updates.layers : (state.draft?.layers || []),
            lastModified: Date.now()
        };
        dispatch({ type: 'UPDATE_DRAFT', payload: updated });

        // 2. Debounce Persistence (Prevent DB Thrashing)
        if (user) {
            if (draftSaveTimeoutRef.current) {
                clearTimeout(draftSaveTimeoutRef.current);
            }
            draftSaveTimeoutRef.current = setTimeout(() => {
                FirestoreService.saveDraft(user.uid, updated).catch(err => 
                    console.error("Failed to auto-save draft", err)
                );
            }, 1000); // Wait 1 second of inactivity before writing to DB
        }
    }, [user, state.draft]);

    const clearDraft = useCallback(async () => {
        if (draftSaveTimeoutRef.current) clearTimeout(draftSaveTimeoutRef.current);
        dispatch({ type: 'UPDATE_DRAFT', payload: null });
        if (user) await FirestoreService.deleteDraft(user.uid);
    }, [user]);

    const resetData = useCallback(async () => {
        dispatch({ type: 'RESET' });
        if (user) {
            await FirestoreService.clearUserData(user.uid);
        }
    }, [user]);

    const loadTemplates = useCallback(async () => {
        // Optimistically add all
        for (const asset of DEMO_ASSETS) {
             dispatch({ type: 'ADD_ASSET', payload: asset });
             if (user) await FirestoreService.saveAsset(user.uid, asset);
        }
    }, [user]);

    const addCredits = useCallback(async (amount: number, description: string = "Purchase") => {
        const newVal = state.credits + amount;
        dispatch({ type: 'SET_CREDITS', payload: newVal });
        Haptics.notificationAsync(NotificationFeedbackType.Success);
        
        if (user) {
            await FirestoreService.adjustCredits(user.uid, amount, 'purchase', description);
        }
    }, [user, state.credits]);

    const spendCredits = useCallback((amount: number): boolean => {
        if (state.credits >= amount) {
            const newVal = state.credits - amount;
            dispatch({ type: 'SET_CREDITS', payload: newVal });
            
            if (user) {
                // Fire and forget
                FirestoreService.adjustCredits(user.uid, -amount, 'spend', 'Generation Cost')
                    .catch(e => console.error("Failed to sync spend", e));
            }
            return true;
        }
        return false;
    }, [user, state.credits]);

    // Memoize the context value to prevent unnecessary re-renders in consumers
    const contextValue = useMemo(() => ({
        ...state,
        addAsset,
        removeAsset,
        saveMockup,
        deleteMockup,
        resetData,
        loadTemplates,
        addCredits: (amt: number) => addCredits(amt, "Reward/Purchase"),
        spendCredits,
        updateDraft,
        clearDraft,
        refreshProfile,
        exportData: async () => {},
        importData: async () => false
    }), [state, user, addAsset, removeAsset, saveMockup, deleteMockup, resetData, loadTemplates, addCredits, spendCredits, updateDraft, clearDraft, refreshProfile]);

    return (
        <GlobalStateContext.Provider value={contextValue}>
            {children}
        </GlobalStateContext.Provider>
    );
};