'use client';
import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

const THEME_KEY = 'vaultchat-theme';

export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const enabled = window.localStorage.getItem(THEME_KEY) === 'dark';
    setDark(enabled);
    document.documentElement.classList.toggle('dark', enabled);
  }, []);

  function toggleTheme() {
    const enabled = !dark;
    setDark(enabled);
    document.documentElement.classList.toggle('dark', enabled);
    window.localStorage.setItem(THEME_KEY, enabled ? 'dark' : 'light');
  }

  return (
    <Button
      type="button"
      variant="secondary"
      aria-label={`Switch to ${dark ? 'light' : 'dark'} mode`}
      aria-pressed={dark}
      onClick={toggleTheme}
    >
      {dark ? <Sun className="h-4 w-4" aria-hidden /> : <Moon className="h-4 w-4" aria-hidden />}
      {dark ? 'Light mode' : 'Dark mode'}
    </Button>
  );
}
