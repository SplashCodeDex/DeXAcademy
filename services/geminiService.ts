/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { GoogleGenAI, Modality, Part, Type, GenerateContentResponse } from "@google/genai";
import { Asset, PlacedLayer } from "../types";
import { apiKeyManager } from "./apiKeyManager";

// --- Helpers ---

/**
 * Ensures we have a clean Base64 string for the API.
 * If input is a URL (Firebase Storage), fetches it and converts to Base64.
 */
const ensureBase64Data = async (input: string): Promise<string> => {
    // If it's already a Data URI
    if (input.startsWith('data:')) {
        return input.split(',')[1];
    }
    
    // If it's a remote URL
    if (input.startsWith('http')) {
        try {
            const response = await fetch(input);
            const blob = await response.blob();
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    const res = reader.result as string;
                    resolve(res.split(',')[1]);
                };
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        } catch (e) {
            console.error("Failed to fetch remote asset for processing", e);
            throw new Error("Could not download remote asset.");
        }
    }
    
    return input; // Fallback assume raw base64 (unsafe but compatible with legacy)
};

/**
 * Parses the Gemini response to extract the base64 image data.
 * Checks for Safety blocks and specific finish reasons.
 */
const extractImageFromResponse = (response: GenerateContentResponse): string => {
  // 1. Check for Immediate Block (Prompt Feedback)
  if (response.promptFeedback?.blockReason) {
    throw new Error(`Generation blocked: ${response.promptFeedback.blockReason}`);
  }

  const candidate = response.candidates?.[0];

  // 2. Check validity of candidate
  if (!candidate) {
    throw new Error("No response candidates returned from AI.");
  }

  // 3. Check Finish Reason (SAFETY, RECITATION, etc.)
  // 'STOP' is the standard success reason.
  if (candidate.finishReason && candidate.finishReason !== 'STOP') {
    throw new Error(`Generation stopped: ${candidate.finishReason}`);
  }

  // 4. Extract Image Data
  if (candidate.content?.parts) {
      for (const part of candidate.content.parts) {
          if (part.inlineData && part.inlineData.data) {
               const mimeType = part.inlineData.mimeType || 'image/png';
               return `data:${mimeType};base64,${part.inlineData.data}`;
          }
      }
  }
  
  throw new Error("AI returned text/metadata but no image data.");
};

/**
 * Executes a Gemini API operation with automatic key rotation and retries.
 */
const callGeminiWithRetry = async <T>(
    operation: (ai: GoogleGenAI) => Promise<T>
): Promise<T> => {
    const MAX_ATTEMPTS = Math.max(1, apiKeyManager.getKeyCount() + 1); // Try keys + 1 retry

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        const key = apiKeyManager.getKey();
        
        // Critical Fix: If no key is available (all exhausted/cooling down), stop immediately.
        if (!key) throw new Error("No API keys configured or all keys are exhausted.");

        try {
            const ai = new GoogleGenAI({ apiKey: key });
            const result = await operation(ai);
            apiKeyManager.markSuccess(key);
            return result;
        } catch (error: unknown) {
            const msg = String(error).toLowerCase();
            const errObj = error as { status?: number };

            // Detect Quota/Rate Limit errors
            const isQuota = 
                errObj.status === 429 || 
                msg.includes('quota') || 
                msg.includes('limit') || 
                msg.includes('429') ||
                msg.includes('exhausted');

            apiKeyManager.markFailed(key, isQuota);
            console.warn(`Attempt ${attempt + 1} failed with key ...${key.slice(-4)}: ${msg}`);

            // If it's the last attempt, throw the error to the caller
            if (attempt === MAX_ATTEMPTS - 1) throw error;

            // Simple backoff if it wasn't a hard quota limit
            if (!isQuota) {
                await new Promise(r => setTimeout(r, 1000));
            }
        }
    }
    throw new Error("All API keys exhausted.");
};

// --- Prompt Construction ---

const constructLayoutHints = (layers: { asset: Asset; placement: PlacedLayer }[]): string => {
  return layers.map((layer, index) => {
      const { x, y, scale, rotation, blendMode } = layer.placement;
      const vPos = y < 33 ? "top" : y > 66 ? "bottom" : "center";
      const hPos = x < 33 ? "left" : x > 66 ? "right" : "center";
      
      return `\n- Logo ${index + 1}: Place at ${vPos}-${hPos} area (approx coords: ${Math.round(x)}% x, ${Math.round(y)}% y). Scale: ${scale}. Rotation: ${rotation}deg. Blend Mode: ${blendMode || 'normal'}. Stacking Order: This logo is ON TOP of Logo ${index} and the Product Base.`;
  }).join('');
};

const constructMockupPrompt = (instruction: string, layoutHints: string, layerCount: number) => `
    User Instructions: ${instruction}
    
    Layout Guidance based on user's rough placement on canvas:
    ${layoutHints}

    System Task: Composite the provided logo images (images 2-${layerCount + 1}) onto the first image (the product) to create a realistic product mockup. 
    Follow the Layout Guidance for positioning if provided, but prioritize realistic surface warping, lighting, and perspective blending.
    
    IMPORTANT STACKING ORDER:
    The images are provided in order from bottom to top. The last image provided is the topmost layer.
    
    IMPORTANT BLEND MODE HANDLING:
    - If Blend Mode is "multiply": The logo should look like it is printed into the fabric, darkening the underlying texture. White areas of the logo should be transparent.
    - If Blend Mode is "screen": The logo should look like a light print on dark fabric.
    
    Output ONLY the resulting image.
`;

// --- Service Methods ---

/**
 * Pings the API to ensure keys are valid and quota is available.
 */
export const validateConnection = async (): Promise<boolean> => {
    try {
        await callGeminiWithRetry(async (ai) => {
            await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: { parts: [{ text: 'ping' }] },
                config: { maxOutputTokens: 1 }
            });
            return true;
        });
        return true;
    } catch (e) {
        console.error("Connection Validation Failed", e);
        return false;
    }
};

/**
 * Analyzes an uploaded image to automatically generate a descriptive name and type.
 */
export const analyzeAsset = async (
    imageBase64: string
): Promise<{ name: string; type: 'product' | 'logo' }> => {
    const cleanB64 = await ensureBase64Data(imageBase64);
    
    return callGeminiWithRetry(async (ai) => {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: {
                parts: [
                    { inlineData: { mimeType: 'image/png', data: cleanB64 } },
                    { text: "Analyze this image. 1. Generate a short, descriptive name (max 4 words). 2. Categorize it as either a 'product' (an object like a shirt, bottle, box) or a 'logo' (graphic, text, symbol). Return JSON." }
                ]
            },
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        name: { type: Type.STRING },
                        type: { type: Type.STRING, enum: ['product', 'logo'] }
                    },
                    required: ['name', 'type']
                }
            }
        });

        return JSON.parse(response.text || '{"name": "Asset", "type": "product"}');
    });
};

export const generateMockup = async (
  product: Asset,
  layers: { asset: Asset; placement: PlacedLayer }[],
  instruction: string
): Promise<string> => {
  const productB64 = await ensureBase64Data(product.data);
  const layersData = await Promise.all(layers.map(async (l) => ({
      ...l,
      b64: await ensureBase64Data(l.asset.data)
  })));

  return callGeminiWithRetry(async (ai) => {
      const model = 'gemini-3-pro-image-preview';

      const parts: Part[] = [
        { inlineData: { mimeType: product.mimeType, data: productB64 } },
      ];

      layersData.forEach((layer) => {
        parts.push({ inlineData: { mimeType: layer.asset.mimeType, data: layer.b64 } });
      });

      const layoutHints = constructLayoutHints(layers);
      const finalPrompt = constructMockupPrompt(instruction, layoutHints, layers.length);
      parts.push({ text: finalPrompt });

      const response = await ai.models.generateContent({
        model,
        contents: { parts },
        config: {
          responseModalities: [Modality.IMAGE],
        },
      });

      return extractImageFromResponse(response);
  });
};

export const generateAsset = async (prompt: string, type: 'logo' | 'product'): Promise<string> => {
    return callGeminiWithRetry(async (ai) => {
        const model = 'gemini-3-pro-image-preview';
        
        const enhancedPrompt = type === 'logo' 
            ? `A high-quality, professional vector-style logo design of a ${prompt}. Isolated on a pure white background. Minimalist and clean, single distinct logo.`
            : `Professional studio product photography of a single ${prompt}. Ghost mannequin style or flat lay. Front view, isolated on neutral background. High resolution, photorealistic. Single object only, no stacks, no duplicates.`;

        const response = await ai.models.generateContent({
            model,
            contents: { parts: [{ text: enhancedPrompt }] },
            config: { responseModalities: [Modality.IMAGE] }
        });

        return extractImageFromResponse(response);
    });
};

export const generateRealtimeComposite = async (
    compositeImageBase64: string,
    prompt: string = "Make this look like a real photo"
  ): Promise<string> => {
    const cleanB64 = await ensureBase64Data(compositeImageBase64);

    return callGeminiWithRetry(async (ai) => {
        const model = 'gemini-3-pro-image-preview';
        const parts: Part[] = [
          { inlineData: { mimeType: 'image/jpeg', data: cleanB64 } },
          { text: `Input is a rough AR composite. Task: ${prompt}. Render the overlaid object naturally into the scene. Match lighting/shadows. Output ONLY the resulting image.` },
        ];

        const response = await ai.models.generateContent({
          model,
          contents: { parts },
          config: { responseModalities: [Modality.IMAGE] },
        });

        return extractImageFromResponse(response);
    });
};

export const removeBackground = async (imageInput: string): Promise<string> => {
    const cleanB64 = await ensureBase64Data(imageInput);

    return callGeminiWithRetry(async (ai) => {
        const model = 'gemini-2.5-flash-image'; 
        const parts: Part[] = [
          { inlineData: { mimeType: 'image/png', data: cleanB64 } },
          { text: 'Remove the background from this image. Return the subject isolated on a transparent background.' },
        ];

        const response = await ai.models.generateContent({
          model,
          contents: { parts },
          config: { responseModalities: [Modality.IMAGE] },
        });

        return extractImageFromResponse(response);
    });
};

export const refineImage = async (imageInput: string, instruction: string): Promise<string> => {
    const cleanB64 = await ensureBase64Data(imageInput);

    return callGeminiWithRetry(async (ai) => {
        const model = 'gemini-3-pro-image-preview'; 
        const parts: Part[] = [
          { inlineData: { mimeType: 'image/png', data: cleanB64 } },
          { text: `Edit this image. Instruction: ${instruction}. Maintain composition. Output ONLY the resulting image.` },
        ];

        const response = await ai.models.generateContent({
          model,
          contents: { parts },
          config: { responseModalities: [Modality.IMAGE] },
        });

        return extractImageFromResponse(response);
    });
};

/**
 * Interprets natural language commands to manipulate studio layers.
 * Uses Gemini Reasoning to calculate new state.
 */
export const interpretStudioCommand = async (
    currentLayers: PlacedLayer[],
    assets: Asset[],
    activeLayerId: string | null,
    command: string
): Promise<{
    action: 'UPDATE' | 'DELETE' | 'CLEAR' | 'UNKNOWN';
    layerId?: string;
    updates?: Partial<PlacedLayer>;
    message: string;
}> => {
    return callGeminiWithRetry(async (ai) => {
        // Use Gemini 3 Flash with Thinking Config for superior spatial reasoning
        const model = 'gemini-3-flash-preview';

        const enrichedLayers = currentLayers.map(l => {
            const asset = assets.find(a => a.id === l.assetId);
            return {
                layerId: l.uid,
                x: l.x,
                y: l.y,
                scale: l.scale,
                rotation: l.rotation,
                assetName: asset?.name || 'Unknown Layer',
                assetType: asset?.type || 'unknown'
            };
        });

        const context = {
            layers: enrichedLayers,
            activeLayerId: activeLayerId,
            canvasSize: "100x100 units",
            center: "50,50"
        };

        const response = await ai.models.generateContent({
            model,
            contents: {
                parts: [{ text: `
                    You are a professional design assistant for a product mockup tool.
                    Current Canvas State: ${JSON.stringify(context)}
                    User Command: "${command}"
                    
                    Your Goal: Interpret the command and calculate the precise new coordinates/properties.
                    
                    Rules:
                    - "Left chest" or "Heart" implies approx x:65, y:30 for a shirt facing front.
                    - "Pocket" implies approx x:65, y:35.
                    - "Center" is x:50, y:50.
                    - Scale 1.0 is default. "Smaller" might be 0.5. "Bigger" might be 1.5.
                    - Identify the target layer by fuzzy matching the asset name (e.g. "red shoe") or using the activeLayerId.
                `}]
            },
            config: {
                // Thinking Budget allows the model to "reason" about where a pocket is
                // before outputting the final JSON coordinates.
                thinkingConfig: { thinkingBudget: 1024 }, 
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        action: { type: Type.STRING, enum: ["UPDATE", "DELETE", "CLEAR", "UNKNOWN"] },
                        layerId: { type: Type.STRING },
                        updates: { 
                            type: Type.OBJECT,
                            properties: {
                                x: { type: Type.NUMBER },
                                y: { type: Type.NUMBER },
                                scale: { type: Type.NUMBER },
                                rotation: { type: Type.NUMBER },
                                blendMode: { type: Type.STRING }
                            }
                        },
                        message: { type: Type.STRING, description: "A short confirmation message to the user." }
                    },
                    required: ["action", "message"]
                }
            }
        });

        if (!response.text) throw new Error("No command generated");
        return JSON.parse(response.text);
    });
};