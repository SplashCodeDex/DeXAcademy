# Mockup Studio Architecture & Rules

## 1. Core Principles
- **Project Name**: Mockup Studio
- **Identity**: A professional, AI-powered product visualization tool. Avoid generic terms like "Cloud Studio".
- **Real Implementation Only**: Do not use `setTimeout` or "mock" logic to simulate features. Use real Web APIs (Payment Request, Web Speech, Web Audio) or real SDKs (Google IMA) for all core functionality.
- **Progressive Web App (PWA)**: Mobile-first design, offline capabilities, touch interactions, and installability.
- **No Build Tools Dependency**: The code runs directly via ES modules in the browser (using standard imports).
- **Separation of Concerns**: UI components vs Business Logic (Hooks/Services) vs Data.

## 2. Directory Structure

### `/components`
- Reusable UI elements (Buttons, Inputs, Layouts).
- **Rule**: Purely presentational. Avoid complex business logic or API calls directly in components.
- **Naming**: `PascalCase.tsx`.

### `/screens`
- Page-level views.
- **Rule**: Connects global state/services to UI components. Handles routing parameters.
- **Naming**: `PascalCase.tsx` (Suffix with `Screen`, e.g., `HomeScreen.tsx`).

### `/hooks`
- Custom React hooks.
- **Rule**: Encapsulate reusable logic or complex state manipulations (e.g., `useCanvasGestures`, `usePWAInstall`).
- **Naming**: `useCamelCase.ts`.

### `/services`
- Domain-specific business logic and API integrations.
- **Rule**: Must wrap **Real APIs**:
  - `adService.ts`: Google IMA SDK (VAST/VPAID).
  - `iapService.ts`: W3C Payment Request API.
  - `geminiService.ts`: @google/genai SDK.
- **Naming**: `camelCase.ts`.

### `/lib`
- Generic utilities, helpers, and constants.
- **Rule**: App-agnostic code (Storage wrappers, Math helpers, Haptics, Audio Synthesis).
- **Naming**: `camelCase.ts`.

### `/context`
- React Context Providers.
- **Rule**: Use for truly global state (Theme, User Session, Data Store).
- **Naming**: `PascalCaseContext.tsx`.

## 3. Coding Standards

### Imports
Order imports by:
1.  React / External Libraries
2.  Types
3.  Context / Hooks
4.  Services / Libs
5.  Components

### Components
- Use Functional Components with `React.FC` or direct function definitions.
- Define `Props` interface immediately above the component.
- Use `export const` (Named Exports).

### Gemini API
- **Client**: Always initialize: `new GoogleGenAI({ apiKey: process.env.API_KEY })`.
- **Models**: 
  - Image Gen/Edit: 'gemini-3-pro-image-preview' (High Res)
  - Fast Text/Reasoning: 'gemini-3-flash-preview' (Low Latency)
  - Background Removal: 'gemini-2.5-flash-image'
- **Safety**: Always handle `response.candidates` checks safely. Check for `inlineData` or `text` existence.
- **Retry Logic**: Use the `apiKeyManager` service for circuit-breaking and rotation.

### Audio & Haptics
- **Audio**: Use `lib/audio.ts` (Web Audio API) for procedural sound generation. Do not load external MP3/WAV files.
- **Haptics**: Use `navigator.vibrate` patterns defined in `lib/haptics.ts`.

### Styling
- **Tailwind CSS**: Use utility classes.
- **Dark Mode**: Default is dark mode (`bg-black`, `text-white`).
- **Safe Areas**: Use `pt-[env(safe-area-inset-top)]` and `pb-[env(safe-area-inset-bottom)]` for mobile layout.

## 4. State Management
- Prefer local state (`useState`) for UI interactions.
- Use `GlobalStateContext` for data shared across screens.
- Use `AsyncStorage` (IndexedDB) for robust data persistence.

## 5. File Constraints
- **Do not create** `src/` folder. Root is the source.
- **Do not use** `require()`. Use `import`.
- **Do not use** `module.exports`. Use `export`.
