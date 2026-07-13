import { createContext, useContext } from 'react';

export const ToastContext = createContext(null);

export function useToastCtx() {
  return useContext(ToastContext);
}
