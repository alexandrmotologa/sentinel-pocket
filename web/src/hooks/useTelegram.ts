import { useEffect, useState, useCallback } from 'react';
import { TelegramUser } from '../types.js';

interface TelegramWebApp {
  initData: string;
  initDataUnsafe: {
    query_id?: string;
    user?: TelegramUser;
    auth_date?: string;
    hash?: string;
  };
  colorScheme: 'light' | 'dark';
  themeParams: Record<string, string>;
  isExpanded: boolean;
  viewportHeight: number;
  viewportStableHeight: number;
  headerColor: string;
  backgroundColor: string;
  ready: () => void;
  expand: () => void;
  close: () => void;
  HapticFeedback?: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
    selectionChanged: () => void;
  };
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}

export function useTelegram() {
  const [isInsideTelegram, setIsInsideTelegram] = useState(false);
  const [user, setUser] = useState<TelegramUser | null>(null);
  const [initData, setInitData] = useState<string>('');
  const [isDark, setIsDark] = useState<boolean>(true);

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg && tg.initData) {
      setIsInsideTelegram(true);
      setInitData(tg.initData);
      if (tg.initDataUnsafe?.user) {
        setUser(tg.initDataUnsafe.user);
      }
      setIsDark(tg.colorScheme === 'dark');
      tg.ready();
      tg.expand();
    } else {
      // Running in standalone web browser
      setIsInsideTelegram(false);
      setInitData('mock');
      setUser({
        id: 10001,
        first_name: 'Alexandr',
        last_name: 'Motologa',
        username: 'alexandrmotologa',
        is_premium: true,
      });
      setIsDark(true);
    }
  }, []);

  const triggerHaptic = useCallback(
    (style: 'light' | 'medium' | 'heavy' = 'medium') => {
      const tg = window.Telegram?.WebApp;
      if (tg?.HapticFeedback) {
        tg.HapticFeedback.impactOccurred(style);
      } else if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(style === 'heavy' ? 40 : 20);
      }
    },
    []
  );

  const triggerNotificationHaptic = useCallback(
    (type: 'error' | 'success' | 'warning' = 'success') => {
      const tg = window.Telegram?.WebApp;
      if (tg?.HapticFeedback) {
        tg.HapticFeedback.notificationOccurred(type);
      } else if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(type === 'error' ? [40, 40, 40] : [20, 30]);
      }
    },
    []
  );

  const toggleTheme = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      if (next) {
        document.documentElement.classList.remove('theme-light');
      } else {
        document.documentElement.classList.add('theme-light');
      }
      return next;
    });
  }, []);

  return {
    isInsideTelegram,
    user,
    setUser,
    initData,
    isDark,
    toggleTheme,
    triggerHaptic,
    triggerNotificationHaptic,
  };
}
