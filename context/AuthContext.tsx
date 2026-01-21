/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { createContext, useContext, useEffect, useState, PropsWithChildren } from 'react';
import { AuthService, User } from '../services/authService';
import { SplashScreen } from '../components/SplashScreen';

interface AuthContextType {
    user: User | null;
    loading: boolean;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error("useAuth must be used within AuthProvider");
    return context;
};

export const AuthProvider = ({ children }: PropsWithChildren<{}>) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = AuthService.onUserChange((usr) => {
            setUser(usr);
            setLoading(false);
        });
        return unsubscribe;
    }, []);

    const logout = async () => {
        await AuthService.logout();
    };

    if (loading) return <SplashScreen />;

    return (
        <AuthContext.Provider value={{ user, loading, logout }}>
            {children}
        </AuthContext.Provider>
    );
};