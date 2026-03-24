import React, { createContext, useContext, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type NotificationType = 'error' | 'success' | 'info' | 'warning';

interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  description?: string;
}

interface NotificationContextType {
  notify: (type: NotificationType, message: string, description?: string) => void;
  error: (message: string, description?: string) => void;
  success: (message: string, description?: string) => void;
  info: (message: string, description?: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const notify = useCallback((type: NotificationType, message: string, description?: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setNotifications((prev) => [...prev, { id, type, message, description }]);

    // Auto-remove after 5 seconds
    setTimeout(() => {
      removeNotification(id);
    }, 5000);
  }, [removeNotification]);

  const error = useCallback((message: string, description?: string) => notify('error', message, description), [notify]);
  const success = useCallback((message: string, description?: string) => notify('success', message, description), [notify]);
  const info = useCallback((message: string, description?: string) => notify('info', message, description), [notify]);

  return (
    <NotificationContext.Provider value={{ notify, error, success, info }}>
      {children}
      <div className="fixed bottom-6 right-6 z-[200] flex flex-col gap-3 w-full max-w-sm pointer-events-none">
        <AnimatePresence mode="popLayout">
          {notifications.map((n) => (
            <motion.div
              key={n.id}
              layout
              initial={{ opacity: 0, x: 20, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.95 }}
              className={cn(
                "pointer-events-auto p-4 rounded-2xl shadow-lg border flex items-start gap-3 backdrop-blur-md",
                n.type === 'error' && "bg-rose-50/90 border-rose-200 text-rose-900",
                n.type === 'success' && "bg-emerald-50/90 border-emerald-200 text-emerald-900",
                n.type === 'info' && "bg-stone-50/90 border-stone-200 text-stone-900",
                n.type === 'warning' && "bg-amber-50/90 border-amber-200 text-amber-900"
              )}
            >
              <div className="shrink-0 mt-0.5">
                {n.type === 'error' && <AlertCircle className="w-5 h-5 text-rose-500" />}
                {n.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
                {n.type === 'info' && <Info className="w-5 h-5 text-stone-500" />}
                {n.type === 'warning' && <AlertCircle className="w-5 h-5 text-amber-500" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold leading-tight">{n.message}</p>
                {n.description && (
                  <p className="text-xs mt-1 opacity-80 leading-relaxed">{n.description}</p>
                )}
              </div>
              <button
                onClick={() => removeNotification(n.id)}
                className="shrink-0 p-1 hover:bg-black/5 rounded-full transition-colors"
              >
                <X className="w-4 h-4 opacity-40" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </NotificationContext.Provider>
  );
};
