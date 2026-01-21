# Mockup Studio

**Mockup Studio** is a Progressive Web App (PWA) for AI-driven product visualization. It allows users to design, visualize, and generate photorealistic product mockups using the Google Gemini API.

## Project Architecture

This project is built with a **No-Build-Tools-Dependency** philosophy for the core logic, running as ES Modules in the browser, though it uses Vite for the dev server and bundling.

### Key Technologies
*   **Framework**: React 19 (Client-Side Only)
*   **Language**: TypeScript
*   **Styling**: Tailwind CSS via CDN script (Runtime) + standard CSS
*   **AI**: @google/genai (Gemini 3/2.5 Models)
*   **State**: React Context + IndexedDB (via custom `AsyncStorage` wrapper)
*   **PWA**: Service Worker (`sw.js`) + Manifest

### Directory Structure
*   `/components`: Pure UI components (Presentational).
*   `/screens`: Page-level logic and route handling.
*   `/hooks`: Reusable logic (`useStudioState`, `useApiKey`).
*   `/services`: External integrations (Gemini, IAP, AdService). **No mocks allowed in production code.**
*   `/lib`: Generic utilities (`audio`, `haptics`, `storage`).
*   `/context`: Global state providers (`GlobalState`, `Auth`).

## Developer Rules

1.  **Real Implementations**: Do not use `setTimeout` to simulate APIs. Use real Web APIs (Web Audio, Payment Request, etc.).
2.  **Mobile First**: Design for touch interactions and mobile viewports.
3.  **No Node.js Runtime Dependencies**: The app must run in a browser environment.
4.  **Strict Typing**: No `any`. Define interfaces in `types.ts`.

## Getting Started

1.  Install dependencies: `npm install`
2.  Run dev server: `npm run dev`
3.  Build for production: `npm run build`

## Environment Variables
The app requires an API Key for Google Gemini.
*   `VITE_API_KEY`: Injected automatically into `process.env` or accessible via `import.meta.env`.
