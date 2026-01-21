/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * SKU FOUNDRY - PROGRESSIVE WEB APP
 * Native-grade performance using standard Web APIs.
 */
import React, { Suspense } from 'react';
import { GeneratedMockup } from './types';
import { ApiKeyProvider } from './hooks/useApiKey';
import { NavigationContainer, createNativeStackNavigator } from './components/Navigation';
import { GlobalStateProvider } from './context/GlobalStateContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { PWAProvider } from './hooks/usePWAInstall';

// Components
import { AdOverlay } from './components/AdOverlay';
import { LoadingSpinner } from './components/LoadingSpinner';
import { LoginScreen } from './screens/LoginScreen'; // Keep Login eager for fast startup
import { ErrorBoundary } from './components/ErrorBoundary';

// Lazy Load Main Screens for Code Splitting
const DashboardScreen = React.lazy(() => import('./screens/DashboardScreen').then(m => ({ default: m.DashboardScreen })));
const AssetsScreen = React.lazy(() => import('./screens/AssetsScreen').then(m => ({ default: m.AssetsScreen })));
const StudioScreen = React.lazy(() => import('./screens/StudioScreen').then(m => ({ default: m.StudioScreen })));
const ResultScreen = React.lazy(() => import('./screens/ResultScreen').then(m => ({ default: m.ResultScreen })));
const GalleryScreen = React.lazy(() => import('./screens/GalleryScreen').then(m => ({ default: m.GalleryScreen })));
const TryOnScreen = React.lazy(() => import('./screens/TryOnScreen').then(m => ({ default: m.TryOnScreen })));
const SettingsScreen = React.lazy(() => import('./screens/SettingsScreen').then(m => ({ default: m.SettingsScreen })));
const StoreScreen = React.lazy(() => import('./screens/StoreScreen').then(m => ({ default: m.StoreScreen })));

// --- Types ---

type RootStackParamList = {
  Login: undefined;
  Dashboard: undefined;
  Assets: undefined;
  Studio: undefined;
  Result: { result: GeneratedMockup };
  Gallery: undefined;
  TryOn: undefined;
  Settings: undefined;
  Store: undefined;
};

// --- App Entry ---

const Stack = createNativeStackNavigator<RootStackParamList>();

// Wrapper to handle conditional routing based on Auth
const AppNavigator = () => {
    const { user } = useAuth();

    if (!user) {
        return <LoginScreen />;
    }

    return (
        <>
            <Suspense fallback={
                <div className="flex-1 bg-black flex items-center justify-center">
                    <LoadingSpinner size={32} color="text-indigo-500" />
                </div>
            }>
                <Stack.Navigator initialRouteName="Dashboard">
                    <Stack.Screen name="Dashboard" component={DashboardScreen} />
                    <Stack.Screen name="Assets" component={AssetsScreen} />
                    <Stack.Screen name="Studio" component={StudioScreen} />
                    <Stack.Screen name="Result" component={ResultScreen} />
                    <Stack.Screen name="Gallery" component={GalleryScreen} />
                    <Stack.Screen name="TryOn" component={TryOnScreen} />
                    <Stack.Screen name="Settings" component={SettingsScreen} />
                    <Stack.Screen name="Store" component={StoreScreen} />
                </Stack.Navigator>
            </Suspense>
            <AdOverlay />
        </>
    );
};

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <ApiKeyProvider>
            <PWAProvider>
              <AuthProvider>
                  <GlobalStateProvider>
                      <NavigationContainer>
                          <AppNavigator />
                      </NavigationContainer>
                  </GlobalStateProvider>
              </AuthProvider>
            </PWAProvider>
        </ApiKeyProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}