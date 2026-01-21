/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { createContext, useContext, useState, useEffect, PropsWithChildren, useMemo, useCallback } from 'react';

// --- Types ---

export type Route<ParamList extends object, RouteName extends keyof ParamList> = {
  key: string;
  name: RouteName;
  params: ParamList[RouteName];
};

export type NavigationProp<ParamList extends object> = {
  navigate: <RouteName extends keyof ParamList>(name: RouteName, params?: ParamList[RouteName]) => void;
  goBack: () => void;
  canGoBack: () => boolean;
  push: <RouteName extends keyof ParamList>(name: RouteName, params?: ParamList[RouteName]) => void;
  replace: <RouteName extends keyof ParamList>(name: RouteName, params?: ParamList[RouteName]) => void;
};

export type NativeStackScreenProps<ParamList extends object, RouteName extends keyof ParamList> = {
  navigation: NavigationProp<ParamList>;
  route: Route<ParamList, RouteName>;
};

// --- Context ---

type NavigationContextType = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  stack: Route<any, any>[];
  direction: 'forward' | 'backward';
  push: (name: string, params?: unknown) => void;
  pop: () => void;
  replace: (name: string, params?: unknown) => void;
};

const NavigationContext = createContext<NavigationContextType | null>(null);

// --- Hooks ---

export function useNavigation<ParamList extends object>() {
  const ctx = useContext(NavigationContext);
  if (!ctx) throw new Error("useNavigation must be used within a NavigationContainer");

  return {
    navigate: ctx.push,
    push: ctx.push,
    goBack: ctx.pop,
    replace: ctx.replace,
    canGoBack: () => ctx.stack.length > 1,
  };
}

export function useRoute<ParamList extends object, RouteName extends keyof ParamList>() {
  const ctx = useContext(NavigationContext);
  if (!ctx) throw new Error("useRoute must be used within a NavigationContainer");
  return ctx.stack[ctx.stack.length - 1] as Route<ParamList, RouteName>;
}

// --- Components ---

export const NavigationContainer = ({ children }: PropsWithChildren<object>) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [stack, setStack] = useState<Route<any, any>[]>([]);
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward');

  useEffect(() => {
    const handlePopState = () => {
      setDirection('backward');
      setStack(prevStack => {
        if (prevStack.length > 1) {
          return prevStack.slice(0, -1);
        }
        return prevStack;
      });
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const push = useCallback((name: string, params: unknown = {}) => {
    const route = { key: Math.random().toString(36).substr(2, 9), name, params };
    window.history.pushState({ key: route.key }, name);
    setDirection('forward');
    setStack(prev => [...prev, route]);
  }, []);

  const pop = useCallback(() => {
    if (window.history.length > 1) {
        window.history.back();
    } else {
        setDirection('backward');
        setStack(prev => prev.length > 1 ? prev.slice(0, -1) : prev);
    }
  }, []);

  const replace = useCallback((name: string, params: unknown = {}) => {
    const route = { key: Math.random().toString(36).substr(2, 9), name, params };
    window.history.replaceState({ key: route.key }, name);
    setDirection('forward');
    setStack(prev => [...prev.slice(0, -1), route]);
  }, []);

  const value = useMemo(() => ({ stack, direction, push, pop, replace }), [stack, direction, push, pop, replace]);

  return (
    <NavigationContext.Provider value={value}>
      {children}
    </NavigationContext.Provider>
  );
};

export const createNativeStackNavigator = <ParamList extends object>() => {
  return {
    Navigator: ({ 
      initialRouteName, 
      children 
    }: PropsWithChildren<{ 
      initialRouteName: keyof ParamList, 
      screenOptions?: { headerShown?: boolean } 
    }>) => {
      const ctx = useContext(NavigationContext);
      
      useEffect(() => {
        if (ctx && ctx.stack.length === 0) {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const route = { key: 'root', name: initialRouteName, params: undefined };
          window.history.replaceState({ key: 'root' }, String(initialRouteName));
          ctx.push(initialRouteName as string); 
        }
      }, []);

      if (!ctx || ctx.stack.length === 0) return null;

      // Map over the entire stack to render all screens (preserves state)
      // We find the child component that matches the route name
      return (
        <div className="flex-1 w-full h-full relative overflow-hidden bg-black">
          {ctx.stack.map((route, index) => {
            const isTop = index === ctx.stack.length - 1;
            // Optimization: Only keep the top 2 screens visible (current + previous for transitions).
            // Deep history is hidden to save GPU memory and layout cost.
            const isVisible = index >= ctx.stack.length - 2;
            
            // Find the matching Screen definition from children
            let ScreenComponent = null;
            React.Children.forEach(children, (child) => {
              if (React.isValidElement(child) && (child.props as any).name === route.name) {
                 ScreenComponent = child;
              }
            });

            if (!ScreenComponent) return null;

            // Animation Logic
            // If it's the top screen, animate it in.
            // If it's a background screen, keep it there.
            let animClass = '';
            if (isTop) {
                 animClass = ctx.direction === 'forward' ? 'animate-slide-in-right' : 'animate-slide-in-left';
            }

            return (
              <div 
                key={route.key}
                className={`absolute inset-0 w-full h-full bg-black ${animClass}`}
                style={{ 
                    zIndex: index,
                    display: isVisible ? 'block' : 'none'
                }}
                aria-hidden={!isTop}
              >
                 {React.cloneElement(ScreenComponent as React.ReactElement<any>, {
                    navigation: { 
                        navigate: ctx.push, 
                        push: ctx.push, 
                        goBack: ctx.pop, 
                        canGoBack: () => ctx.stack.length > 1,
                        replace: ctx.replace
                    },
                    route: route
                 })}
              </div>
            );
          })}
        </div>
      );
    },
    Screen: <RouteName extends keyof ParamList>({ 
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      name, 
      component: Component,
      navigation, // Injected by Navigator
      route       // Injected by Navigator
    }: { 
      name: RouteName, 
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      component: React.ComponentType<any>,
      options?: { headerShown?: boolean },
      navigation?: any,
      route?: any
    }) => {
        return <Component navigation={navigation} route={route} />;
    }
  };
};