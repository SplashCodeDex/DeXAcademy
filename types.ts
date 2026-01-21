/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

// Extend Window interface for External SDKs
declare global {
  interface Window {
    google: any; // Google IMA SDK
  }
}

export interface Asset {
  id: string;
  type: 'logo' | 'product';
  name: string;
  data: string; // Base64
  mimeType: string;
}

export interface PlacedLayer {
  uid: string; // unique instance id
  assetId: string;
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  scale: number; // 1 = 100%
  rotation: number;
  blendMode?: 'normal' | 'multiply' | 'screen';
}

export interface Draft {
  productId: string | null;
  layers: PlacedLayer[];
  lastModified: number;
}

export interface GeneratedMockup {
  id: string;
  imageUrl: string;
  prompt: string;
  createdAt: number;
  layers?: PlacedLayer[]; // Store layout used
  productId?: string;
  
  // Community / Publishing Fields
  authorId?: string;
  authorName?: string;
  likes?: number;
  publishedAt?: number;
}

export type AppView = 'dashboard' | 'assets' | 'studio' | 'gallery' | 'try-on';

export interface LoadingState {
  isGenerating: boolean;
  message: string;
}

export interface GlobalContextType {
  assets: Asset[];
  addAsset: (a: Asset) => void;
  removeAsset: (id: string) => void;
  savedMockups: GeneratedMockup[];
  saveMockup: (m: GeneratedMockup) => void;
  resetData: () => void;
  loadTemplates: () => void;
  
  // Persistence
  draft: Draft | null;
  updateDraft: (d: Partial<Draft>) => void;
  clearDraft: () => void;

  // Economy
  credits: number;
  addCredits: (amount: number) => void;
  spendCredits: (amount: number) => boolean;
}