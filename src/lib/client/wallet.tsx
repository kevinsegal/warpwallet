"use client";

/**
 * Client wallet context. Keys are generated and held only in browser memory
 * after unlock; at rest they live as an AES-GCM encrypted keystore in
 * localStorage. Nothing here ever transmits a private key — the server only
 * receives signed transactions and signed action authorizations.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  generateKeyPair,
  keyPairFromPrivateHex,
  signDigest,
  sha256d,
  bytesToHex,
  type KeyPair,
} from "@/lib/warp/crypto";
import {
  decryptPrivateKey,
  encryptPrivateKey,
  type EncryptedKeystore,
} from "@/lib/warp/keystore";
import { buildSignedTransfer, type Transaction } from "@/lib/warp/tx";

const STORAGE_KEY = "warpwallet:keystore:v1";

export interface Account {
  address: string;
  balance: number;
  nonce: number;
}

export interface SignedAction {
  action: string;
  address: string;
  pubkey: string;
  signature: string;
}

type Status = "loading" | "none" | "locked" | "unlocked";

interface WalletContextValue {
  status: Status;
  address: string | null;
  account: Account | null;
  tag: string | null;
  createWallet: (password: string) => Promise<KeyPair>;
  importWallet: (privateKeyHex: string, password: string) => Promise<KeyPair>;
  unlock: (password: string) => Promise<void>;
  lock: () => void;
  forget: () => void;
  refresh: () => Promise<void>;
  exportPrivateKey: () => string | null;
  signTransferTo: (to: string, amountFlux: number, feeFlux: number) => Transaction;
  signAction: (action: string) => SignedAction;
}

const WalletContext = createContext<WalletContextValue | null>(null);

function actionDigestHex(action: string): string {
  return bytesToHex(sha256d(new TextEncoder().encode(action)));
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [keystore, setKeystore] = useState<EncryptedKeystore | null>(null);
  const [keypair, setKeypair] = useState<KeyPair | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [tag, setTag] = useState<string | null>(null);

  // Load any persisted keystore on mount.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        setKeystore(JSON.parse(raw) as EncryptedKeystore);
        setStatus("locked");
      } else {
        setStatus("none");
      }
    } catch {
      setStatus("none");
    }
  }, []);

  const address = keypair?.address ?? keystore?.address ?? null;

  const refresh = useCallback(async () => {
    if (!address) return;
    try {
      const res = await fetch(`/api/account?address=${address}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setAccount(data.account);
      setTag(data.tag ?? null);
    } catch {
      /* offline; ignore */
    }
  }, [address]);

  useEffect(() => {
    if (address) void refresh();
  }, [address, refresh]);

  const persist = useCallback((ks: EncryptedKeystore) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ks));
    setKeystore(ks);
  }, []);

  const createWallet = useCallback(
    async (password: string) => {
      const kp = generateKeyPair();
      const ks = await encryptPrivateKey(kp.privateKeyHex, password);
      persist(ks);
      setKeypair(kp);
      setStatus("unlocked");
      return kp;
    },
    [persist],
  );

  const importWallet = useCallback(
    async (privateKeyHex: string, password: string) => {
      const kp = keyPairFromPrivateHex(privateKeyHex.trim());
      const ks = await encryptPrivateKey(kp.privateKeyHex, password);
      persist(ks);
      setKeypair(kp);
      setStatus("unlocked");
      return kp;
    },
    [persist],
  );

  const unlock = useCallback(
    async (password: string) => {
      if (!keystore) throw new Error("no wallet to unlock");
      const priv = await decryptPrivateKey(keystore, password);
      setKeypair(keyPairFromPrivateHex(priv));
      setStatus("unlocked");
    },
    [keystore],
  );

  const lock = useCallback(() => {
    setKeypair(null);
    setStatus(keystore ? "locked" : "none");
  }, [keystore]);

  const forget = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setKeystore(null);
    setKeypair(null);
    setAccount(null);
    setTag(null);
    setStatus("none");
  }, []);

  const exportPrivateKey = useCallback(
    () => keypair?.privateKeyHex ?? null,
    [keypair],
  );

  const signTransferTo = useCallback(
    (to: string, amountFlux: number, feeFlux: number): Transaction => {
      if (!keypair || !account) throw new Error("wallet locked");
      return buildSignedTransfer({
        to,
        amount: amountFlux,
        fee: feeFlux,
        nonce: account.nonce,
        privateKeyHex: keypair.privateKeyHex,
      });
    },
    [keypair, account],
  );

  const signAction = useCallback(
    (action: string): SignedAction => {
      if (!keypair) throw new Error("wallet locked");
      return {
        action,
        address: keypair.address,
        pubkey: keypair.publicKeyHex,
        signature: signDigest(actionDigestHex(action), keypair.privateKeyHex),
      };
    },
    [keypair],
  );

  const value = useMemo<WalletContextValue>(
    () => ({
      status,
      address,
      account,
      tag,
      createWallet,
      importWallet,
      unlock,
      lock,
      forget,
      refresh,
      exportPrivateKey,
      signTransferTo,
      signAction,
    }),
    [
      status, address, account, tag, createWallet, importWallet, unlock, lock,
      forget, refresh, exportPrivateKey, signTransferTo, signAction,
    ],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within WalletProvider");
  return ctx;
}
