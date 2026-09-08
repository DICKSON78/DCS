import { createContext, useContext, useEffect, useState } from "react";
import { DEFAULT_CREDENTIALS } from "./api.js";

const CredentialsContext = createContext(null);
const KEY = "dcs:credentials:v1";

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULT_CREDENTIALS, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return DEFAULT_CREDENTIALS;
}

export function CredentialsProvider({ children }) {
  const [creds, setCreds] = useState(load);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(creds));
  }, [creds]);

  return (
    <CredentialsContext.Provider value={{ creds, setCreds, open, setOpen }}>
      {children}
    </CredentialsContext.Provider>
  );
}

export function useCredentials() {
  return useContext(CredentialsContext);
}