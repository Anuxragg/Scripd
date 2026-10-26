"use client";

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_CHANGE_EVENT = "scripd_client_storage_change";

export function notifyStorageChange() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(STORAGE_CHANGE_EVENT));
  }
}

export function subscribeStorage(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", callback);
  window.addEventListener(STORAGE_CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(STORAGE_CHANGE_EVENT, callback);
  };
}

const memoryCache = new Map<string, { raw: string | null; parsed: unknown }>();

export function getStorageSnapshot<T>(key: string, defaultValue: T): T {
  if (typeof window === "undefined") return defaultValue;
  try {
    const raw = localStorage.getItem(key);
    const cached = memoryCache.get(key);
    if (cached && cached.raw === raw) {
      return cached.parsed as T;
    }
    const parsed = raw !== null ? (JSON.parse(raw) as T) : defaultValue;
    memoryCache.set(key, { raw, parsed });
    return parsed;
  } catch {
    return defaultValue;
  }
}

export function setStorageItem<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    const raw = JSON.stringify(value);
    localStorage.setItem(key, raw);
    memoryCache.set(key, { raw, parsed: value });
    notifyStorageChange();
  } catch {
    // Safe ignore
  }
}

export function removeStorageItem(key: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(key);
    memoryCache.delete(key);
    notifyStorageChange();
  } catch {
    // Safe ignore
  }
}

export function useClientStorage<T>(
  key: string,
  defaultValue: T,
): [T, (val: T | ((prev: T) => T)) => void] {
  const getSnapshot = useCallback(
    () => getStorageSnapshot<T>(key, defaultValue),
    [key, defaultValue],
  );
  const getServerSnapshot = useCallback(() => defaultValue, [defaultValue]);

  const value = useSyncExternalStore(subscribeStorage, getSnapshot, getServerSnapshot);

  const setValue = useCallback(
    (action: T | ((prev: T) => T)) => {
      const current = getStorageSnapshot<T>(key, defaultValue);
      const next = typeof action === "function" ? (action as (prev: T) => T)(current) : action;
      setStorageItem(key, next);
    },
    [key, defaultValue],
  );

  return [value, setValue];
}
