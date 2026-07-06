/**
 * Toast Store File. This file contains the implementation of a Zustand store for managing toast notifications
 * in the application. The store includes properties for the list of toasts and actions to add or remove toasts.
 */
import React from 'react';
import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';

export type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  message: string | React.ReactNode; //React.ReactNode allows for more complex content(used for easter egg toast from footer)
  type: ToastType;
}

interface ToastStore {
  toasts: Toast[];
  addToast: (message: string | React.ReactNode, type: ToastType) => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (message, type) => {
    const id = uuidv4();
    set((state) => {
      // Prevent duplicate toasts with the same message from being added
      if (state.toasts.some((t) => t.message === message)) {
        return state;
      }

      return { toasts: [...state.toasts, { id, message, type }] };
    });

    // Auto-remove after 4 seconds
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, 4000);
  },
  removeToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));
