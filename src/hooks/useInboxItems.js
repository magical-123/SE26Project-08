import { useEffect, useState } from 'react';
import { inboxItems } from '../mock/inboxData';

const STORAGE_KEY = 'infodigest_inbox_items';

function loadInitialItems() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch {
    // ignore parse/storage errors
  }
  return null;
}

let sharedItems = loadInitialItems();
const listeners = new Set();

function notify(nextItems) {
  listeners.forEach(listener => listener(nextItems));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('inbox-items-changed'));
  }
}

function persist(nextItems) {
  sharedItems = nextItems;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextItems));
    } catch {
      // ignore storage errors
    }
  }
  notify(nextItems);
}

export function useInboxItems() {
  const [items, setLocalItems] = useState(() => sharedItems ?? inboxItems);

  useEffect(() => {
    const listener = (nextItems) => {
      setLocalItems(nextItems ?? inboxItems);
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const setItems = (nextItems) => {
    const normalized = typeof nextItems === 'function'
      ? nextItems(sharedItems ?? inboxItems)
      : nextItems;
    persist(normalized);
  };

  const togglePremium = (id) => {
    const current = sharedItems ?? inboxItems;
    const next = current.map(item => {
      if (item.id !== id) return item;
      const isPremium = item.hasNote || item.aiPremium || item.userPremium;
      if (isPremium) {
        return { ...item, hasNote: false, aiPremium: false, userPremium: false, note: '', tags: [] };
      }
      return { ...item, userPremium: true };
    });
    persist(next);
  };

  const saveNote = (id, note, tags) => {
    const current = sharedItems ?? inboxItems;
    const next = current.map(item =>
      item.id === id
        ? { ...item, hasNote: true, note, tags }
        : item
    );
    persist(next);
  };

  const updateItem = (id, patch) => {
    const current = sharedItems ?? inboxItems;
    const next = current.map(item =>
      item.id === id ? { ...item, ...patch } : item
    );
    persist(next);
  };

  return { items, setItems, togglePremium, saveNote, updateItem };
}
