/**
 * Centralized Socket.IO connection manager for Scribblitz.
 * Ensures a single persistent socket connection across the Next.js app.
 */

import { useEffect, useState, useMemo } from 'react';
import { io, Socket } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';

const LOCAL_STORAGE_KEY = 'scribblitz_token';
export const ACTIVE_ROOM_KEY = 'scribblitz_active_room';

//We declare the socket instance OUTSIDE the hook.
//This ensures that React Strict Mode's double-mounting does not create duplicate socket connection
let socketInstance: Socket | null = null;

/**
 * Creates or returns the singleton Socket.IO client instance.
 * On first invocation it generates (or retrieves) a persistent session token from
 * `localStorage` and initialises a new `Socket` configured with token-based auth.
 * Subsequent calls return the same instance, preventing duplicate connections
 * even under React Strict Mode's double-mount behaviour.
 *
 * @returns {Socket} The shared Socket.IO client instance.
 */
const getSocket = (): Socket => {
  if (socketInstance) return socketInstance; // Return existing instance if already created

  const SERVER_URL = process.env.NEXT_PUBLIC_GAME_SERVER_URL;
  if (!SERVER_URL && process.env.NODE_ENV === 'production') {
    throw new Error('FATAL: NEXT_PUBLIC_GAME_SERVER_URL is missing! Check your VPS .env file.');
  }

  // Safe to fallback to localhost ONLY in development mode
  const FINAL_URL = SERVER_URL || 'http://localhost:3001';

  //Check for an existing session token or create a new one
  let token = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (!token) {
    token = uuidv4();
    localStorage.setItem(LOCAL_STORAGE_KEY, token);
  }

  //Initialize the connection
  socketInstance = io(FINAL_URL, {
    auth: { token }, // Send the token for authentication during the handshake
    autoConnect: false,
  });

  return socketInstance;
};

/**
 * Tears down the singleton socket connection.
 * Removes all registered event listeners, disconnects from the server,
 * and nullifies the cached instance so a fresh connection will be created
 * on the next call to {@link getSocket}.
 * Intended for "Leave Game" flows where the user deliberately exits a room.
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

  // Derive the ID synchronously
  const userId = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(LOCAL_STORAGE_KEY);
  }, []);

  useEffect(() => {
    if (!socket) return; //Socket not initialized yet (shouldn't happen due to lazy init, but just in case)

    // SMART CONNECT: If they have an active room in localStorage, we attempt to connect
    // immediately. Otherwise, we wait for them to click "Create/Join Room" which triggers the connection.
    const activeRoom = localStorage.getItem(ACTIVE_ROOM_KEY);
    if (activeRoom && !socket.connected) {
      const ioSocket = getSocket(); // Get the socket instance (should be the same as `socket` state)

      ioSocket.auth = {
        ...socket.auth,
        expectedRoom: activeRoom, //Inform the server that we are trying to reconnect to an active room
      };
      ioSocket.connect();
    }

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

  return { socket, isConnected, connectionError, userId };
};
