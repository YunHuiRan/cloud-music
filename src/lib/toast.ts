import { create } from "zustand";

interface ToastItem {
  id: number;
  message: string;
}

interface ToastState {
  items: ToastItem[];
  push: (message: string) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;

export const useToasts = create<ToastState>((set) => ({
  items: [],
  push: (message) => {
    const id = nextId++;
    set((state) => ({ items: [...state.items, { id, message }] }));
    window.setTimeout(() => {
      set((state) => ({ items: state.items.filter((item) => item.id !== id) }));
    }, 2600);
  },
  dismiss: (id) => {
    set((state) => ({ items: state.items.filter((item) => item.id !== id) }));
  },
}));

export function toast(message: string): void {
  useToasts.getState().push(message);
}
