/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ImagePickerResult {
  canceled: boolean;
  assets: Array<{
    uri: string;
    width: number;
    height: number;
    mimeType?: string;
    base64?: string;
    fileName?: string;
  }> | null;
}

const MAX_DIMENSION = 1024;
// Use max quality to prevent artifacts on logos, AI models handle size well.
const COMPRESSION_QUALITY = 1.0; 

const resizeImage = (img: HTMLImageElement): string => {
  let width = img.width;
  let height = img.height;

  // Calculate new dimensions
  if (width > height) {
    if (width > MAX_DIMENSION) {
      height = Math.round((height * MAX_DIMENSION) / width);
      width = MAX_DIMENSION;
    }
  } else {
    if (height > MAX_DIMENSION) {
      width = Math.round((width * MAX_DIMENSION) / height);
      height = MAX_DIMENSION;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  
  if (!ctx) return img.src; // Fallback to original if context fails

  ctx.drawImage(img, 0, 0, width, height);
  
  // Always enforce PNG to preserve transparency (Alpha Channel).
  // This is critical for Logos and SVGs imported into the canvas.
  // Using 'image/jpeg' would replace transparent backgrounds with black.
  return canvas.toDataURL('image/png', COMPRESSION_QUALITY);
};

export const launchImageLibraryAsync = async (options: {
  mediaTypes: 'Images';
  allowsEditing?: boolean;
  quality?: number;
}): Promise<ImagePickerResult> => {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.display = 'none';
    
    document.body.appendChild(input);
    
    const cleanup = () => {
      if (document.body.contains(input)) {
        document.body.removeChild(input);
      }
      window.removeEventListener('focus', handleFocusBack);
    };

    const handleFocusBack = () => {
      setTimeout(() => {
        if (!input.value) {
          resolve({ canceled: true, assets: null });
          cleanup();
        }
      }, 500);
    };

    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) {
        resolve({ canceled: true, assets: null });
        cleanup();
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const originalUri = event.target?.result as string;
        
        const img = new Image();
        img.onload = () => {
          // Perform resize
          const resizedUri = resizeImage(img);
          
          resolve({
            canceled: false,
            assets: [{
              uri: resizedUri, 
              width: img.width > img.height ? (img.width > MAX_DIMENSION ? MAX_DIMENSION : img.width) : (img.height > MAX_DIMENSION ? Math.round(img.width * MAX_DIMENSION / img.height) : img.width),
              height: img.height > img.width ? (img.height > MAX_DIMENSION ? MAX_DIMENSION : img.height) : (img.width > MAX_DIMENSION ? Math.round(img.height * MAX_DIMENSION / img.width) : img.height),
              mimeType: 'image/png', // Enforced PNG
              fileName: file.name,
              base64: resizedUri,
            }]
          });
          cleanup();
        };
        img.onerror = () => {
             console.error("Failed to load image for resizing");
             resolve({ canceled: true, assets: null });
             cleanup();
        };
        img.src = originalUri;
      };
      
      reader.onerror = () => {
          console.error("FileReader failed");
          resolve({ canceled: true, assets: null });
          cleanup();
      };
      
      reader.readAsDataURL(file);
    };

    window.addEventListener('focus', handleFocusBack);
    input.click();
  });
};