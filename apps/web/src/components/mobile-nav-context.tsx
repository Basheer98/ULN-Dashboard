"use client";

import { createContext, useContext } from "react";

const MobileNavContext = createContext<{ openMenu: () => void } | null>(null);

export function useMobileNav() {
  return useContext(MobileNavContext);
}

export { MobileNavContext };
