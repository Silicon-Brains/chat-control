import { create } from 'zustand';

export interface Toast {
  id: number;
  message: string;
  tone: 'info' | 'error' | 'success';
}

interface ToastState {
  toasts: Toast[];
  push: (message: string, tone?: Toast['tone']) => void;
  dismiss: (id: number) => void;
}

let seq = 0;

export const useToasts = create<ToastState>((set, get) => ({
  toasts: [],
  push: (message, tone = 'info') => {
    const id = ++seq;
    set((s) => ({ toasts: [...s.toasts, { id, message, tone }] }));
    setTimeout(() => get().dismiss(id), 5000);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const toast = {
  info: (m: string) => useToasts.getState().push(m, 'info'),
  error: (m: string) => useToasts.getState().push(m, 'error'),
  success: (m: string) => useToasts.getState().push(m, 'success'),
};
