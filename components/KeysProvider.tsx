"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { currentKeys, publishKeys, subscribeKeys } from "@/lib/client/api";
import { clearKeys, isKeystoreSupported, saveKeys } from "@/lib/client/keystore";
import type { UserKeys } from "@/lib/keys";

type Ctx = { keys: UserKeys; ready: boolean; supported: boolean; save: (k: UserKeys) => Promise<void>; clear: () => void };
const KeysCtx = createContext<Ctx>({ keys: {}, ready: false, supported: true, save: async () => {}, clear: () => {} });

export const useKeys = () => useContext(KeysCtx);

export function KeysProvider({ children }: { children: ReactNode }) {
  const [keys, setKeys] = useState<UserKeys>({});
  const [ready, setReady] = useState(false);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    setSupported(isKeystoreSupported());
    void currentKeys().then((k) => {
      setKeys(k);
      setReady(true);
    });
    return subscribeKeys(setKeys);
  }, []);

  const save = useCallback(async (k: UserKeys) => {
    await saveKeys(k);
    publishKeys(k);
  }, []);

  const clear = useCallback(() => {
    clearKeys();
    publishKeys({});
  }, []);

  const value = useMemo(() => ({ keys, ready, supported, save, clear }), [keys, ready, supported, save, clear]);
  return <KeysCtx.Provider value={value}>{children}</KeysCtx.Provider>;
}
