/**
 * Centralized Socket.IO connection manager for Scribblitz.
 * Ensures a single persistent socket connection across the Next.js app.
 */

import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';

const LOCAL_STORAGE_KEY = 'scribblitz_token';
const SERVER_URL = process.env.NEXT_PUBLIC_GAME_SERVER_URL || 'http://localhost:3001';

//We declare the socket instance OUTSIDE the hook.
//This ensures that React Strict Mode's double-mounting does not create duplicate socket connection
let socketInstance: Socket | null = null;

/**
 * Creates or returns the existing socket instance outside the React lifecycle.
 */
const getSocket = (): Socket => {
  if (socketInstance) return socketInstance; // Return existing instance if already created

  //Check for an existing session token or create a new one
  let token = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (!token) {
    token = uuidv4();
    localStorage.setItem(LOCAL_STORAGE_KEY, token);
  }

  //Initialize the connection
  socketInstance = io(SERVER_URL, {
    auth: { token },
    autoConnect: true,
  });

  return socketInstance;
};

/**
 * Exposing a manual disconnect function for "Leave Game" buttons.
 */
export const disconnectSocket = () => {
  if (!socketInstance) return;
  socketInstance.removeAllListeners();
  socketInstance.disconnect();
  socketInstance = null;
};

/**
 * Custom React hook to manage the Socket.IO connection for the game.
 * The hook initializes the socket connection on mount, handles authentication via a token stored in localStorage,
 * and sets up event listeners to track the connection status. The socket instance is shared across all components
 * that use this hook, ensuring a single persistent connection throughout the app.
 * @returns An object containing the socket instance and the connection status.
 *
 */
export const useGameSocket = () => {
  //Lazy initialization of the socket instance to ensure it only runs in the browser and not during SSR.
  const [socket] = useState<Socket | null>(() => {
    if (typeof window === 'undefined') return null; //We are on server
    return getSocket(); //we are on browser
  });

  const [isConnected, setIsConnected] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return getSocket().connected;
  });

  const [connectionError, setConnectionError] = useState<string | null>(null);

  useEffect(() => {
    if (!socket) return; //Socket not initialized yet (shouldn't happen due to lazy init, but just in case)

    const onConnect = () => {
      console.log('[Socket] Connected: ', socket.id);
      setIsConnected(true);
      setConnectionError(null);
    };

    const onDisconnect = (reason: string) => {
      console.log('[Socket] Disconnected: ', reason);
      setIsConnected(false);
    };

    const onConnectError = (err: Error) => {
      console.error('[Socket] Connection Error: ', err.message);
      setConnectionError(err.message);
      setIsConnected(false);
    };

    //Remove first to avoid duplicate listeners during Next.js HMR/Fast Refresh
    socket.off('connect', onConnect);
    socket.off('disconnect', onDisconnect);
    socket.off('connect_error', onConnectError);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);

    //clean up listeners on unmount
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
    };
  }, [socket]);

  return { socket, isConnected, connectionError };
};
