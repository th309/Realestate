"use client";

/**
 * USE DETAIL PANEL HOOK
 *
 * Manages open/close state for the admin detail panel.
 * Delays clearing the active card by 400ms on close so exit animations
 * can complete before the content disappears.
 */

import { useState, useCallback } from "react";

export interface DetailPanelState {
  isOpen: boolean;
  activeCard: string | null;
  openPanel: (cardId: string) => void;
  closePanel: () => void;
}

export function useDetailPanel(): DetailPanelState {
  const [isOpen, setIsOpen] = useState(false);
  const [activeCard, setActiveCard] = useState<string | null>(null);

  const openPanel = useCallback((cardId: string) => {
    setActiveCard(cardId);
    setIsOpen(true);
  }, []);

  const closePanel = useCallback(() => {
    setIsOpen(false);
    // Delay clearing activeCard so close animation can play out
    setTimeout(() => {
      setActiveCard(null);
    }, 400);
  }, []);

  return { isOpen, activeCard, openPanel, closePanel };
}
