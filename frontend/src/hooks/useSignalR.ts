import { useEffect, useRef, useCallback, useState } from 'react';
import * as signalR from '@microsoft/signalr';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5050';

export function useSignalR(hubPath: string) {
    const connectionRef = useRef<signalR.HubConnection | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [connectionError, setConnectionError] = useState<string | null>(null);

    useEffect(() => {
        const token = localStorage.getItem('accessToken');

        const connection = new signalR.HubConnectionBuilder()
            .withUrl(`${API_URL}${hubPath}`, {
                accessTokenFactory: () => token || '',
            })
            .withAutomaticReconnect()
            .configureLogging(signalR.LogLevel.Information)
            .build();

        connectionRef.current = connection;

        // Handle connection state changes
        connection.onreconnecting(() => {
            setIsConnected(false);
            console.log(`Reconnecting to ${hubPath}...`);
        });

        connection.onreconnected(() => {
            setIsConnected(true);
            console.log(`Reconnected to ${hubPath}`);
        });

        connection.onclose(() => {
            setIsConnected(false);
            console.log(`Disconnected from ${hubPath}`);
        });

        connection.start()
            .then(() => {
                setIsConnected(true);
                setConnectionError(null);
                console.log(`Connected to ${hubPath}`);
            })
            .catch(err => {
                setConnectionError(err.message);
                console.error(`Failed to connect to ${hubPath}:`, err);
            });

        return () => {
            connection.stop();
        };
    }, [hubPath]);

    const on = useCallback((event: string, callback: (...args: unknown[]) => void) => {
        connectionRef.current?.on(event, callback);
    }, []);

    const off = useCallback((event: string, callback: (...args: unknown[]) => void) => {
        connectionRef.current?.off(event, callback);
    }, []);

    const invoke = useCallback(async (method: string, ...args: unknown[]) => {
        if (connectionRef.current?.state === signalR.HubConnectionState.Connected) {
            return connectionRef.current.invoke(method, ...args);
        }
        throw new Error('Not connected');
    }, []);

    // Wait for connection before invoking
    const invokeWhenReady = useCallback(async (method: string, ...args: unknown[]) => {
        const maxRetries = 10;
        let retries = 0;
        
        while (retries < maxRetries) {
            if (connectionRef.current?.state === signalR.HubConnectionState.Connected) {
                return connectionRef.current.invoke(method, ...args);
            }
            await new Promise(resolve => setTimeout(resolve, 500));
            retries++;
        }
        throw new Error('Connection timeout');
    }, []);

    return { 
        connection: connectionRef.current, 
        isConnected, 
        connectionError,
        on, 
        off, 
        invoke,
        invokeWhenReady 
    };
}

export function useClassroomHub() {
    return useSignalR('/hubs/classroom');
}

export function useExamHub() {
    return useSignalR('/hubs/exam');
}
