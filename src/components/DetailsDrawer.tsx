"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { FeatherX } from "@subframe/core";
import { Drawer } from "@/ui/components/Drawer";
import { IconButton } from "@/ui/components/IconButton";

const DRAWER_BACKDROP_ANIMATION =
  "data-[state=open]:animate-drawer-backdrop-in data-[state=closed]:animate-drawer-backdrop-out motion-reduce:animate-none";

const DRAWER_PANEL_ANIMATION =
  "data-[state=open]:animate-drawer-in data-[state=closed]:animate-drawer-out motion-reduce:animate-none";

/** Expected exit duration — keep in sync with `drawer-out` in tailwind.config.js */
export const DRAWER_CLOSE_ANIMATION_MS = 250;

/** Fallback when `animationend` does not fire (e.g. prefers-reduced-motion) */
export const DRAWER_CLOSE_FALLBACK_MS = 300;

interface DetailsDrawerProps {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Called after the exit animation finishes. Enables deferred-close handling. */
  onCloseComplete?: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  titleAdornment?: React.ReactNode;
  bodyClassName?: string;
  children: React.ReactNode;
}

/**
 * Reusable right-side, full-height details panel (orders today, customers
 * later). Provides the header with title + close button and a scrollable
 * body; content is supplied by the caller.
 *
 * When `onCloseComplete` is set, closing plays the exit animation first and
 * only then invokes the callback (with a timeout fallback).
 */
export function DetailsDrawer({
  open: openProp,
  onOpenChange,
  onCloseComplete,
  title,
  subtitle,
  titleAdornment,
  bodyClassName,
  children,
}: DetailsDrawerProps) {
  const [isOpen, setIsOpen] = useState(openProp);
  const panelNodeRef = useRef<HTMLDivElement | null>(null);
  const isClosingRef = useRef(false);
  const closeCompleteCalledRef = useRef(false);
  const fallbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const invokeCloseCompleteRef = useRef<() => void>(() => {});

  const clearFallbackTimeout = useCallback(() => {
    if (fallbackTimeoutRef.current) {
      clearTimeout(fallbackTimeoutRef.current);
      fallbackTimeoutRef.current = null;
    }
  }, []);

  const invokeCloseComplete = useCallback(() => {
    if (!onCloseComplete || closeCompleteCalledRef.current) return;
    closeCompleteCalledRef.current = true;
    isClosingRef.current = false;
    clearFallbackTimeout();
    onCloseComplete();
  }, [clearFallbackTimeout, onCloseComplete]);

  invokeCloseCompleteRef.current = invokeCloseComplete;

  const setPanelRef = useCallback((node: HTMLDivElement | null) => {
    panelNodeRef.current = node;
  }, []);

  useEffect(() => {
    setIsOpen(openProp);
    if (openProp) {
      isClosingRef.current = false;
      closeCompleteCalledRef.current = false;
      clearFallbackTimeout();
    }
  }, [openProp, clearFallbackTimeout]);

  useEffect(() => {
    return () => clearFallbackTimeout();
  }, [clearFallbackTimeout]);

  const beginCloseComplete = useCallback(() => {
    if (!onCloseComplete || isClosingRef.current) return;

    closeCompleteCalledRef.current = false;
    isClosingRef.current = true;
    clearFallbackTimeout();

    const panel = panelNodeRef.current;
    if (panel) {
      const handleAnimationEnd = (event: AnimationEvent) => {
        if (event.target !== panel) return;
        if (event.animationName !== "drawer-out") return;
        panel.removeEventListener("animationend", handleAnimationEnd);
        invokeCloseCompleteRef.current();
      };
      panel.addEventListener("animationend", handleAnimationEnd);
    }

    fallbackTimeoutRef.current = setTimeout(
      invokeCloseComplete,
      DRAWER_CLOSE_FALLBACK_MS,
    );
  }, [clearFallbackTimeout, invokeCloseComplete, onCloseComplete]);

  const scheduleCloseComplete = useCallback(() => {
    // Wait for React to commit open=false so drawer-out is active before listening.
    requestAnimationFrame(() => {
      requestAnimationFrame(beginCloseComplete);
    });
  }, [beginCloseComplete]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setIsOpen(true);
      onOpenChange?.(true);
      return;
    }

    if (onCloseComplete) {
      setIsOpen(false);
      scheduleCloseComplete();
      return;
    }

    setIsOpen(false);
    onOpenChange?.(false);
  };

  const drawerOpen = onCloseComplete ? isOpen : openProp;

  return (
    <Drawer
      open={drawerOpen}
      onOpenChange={handleOpenChange}
      className={DRAWER_BACKDROP_ANIMATION}
    >
      <Drawer.Content ref={setPanelRef} className={DRAWER_PANEL_ANIMATION}>
        <div className="flex h-full w-[480px] max-w-full flex-col items-start bg-default-background mobile:w-screen">
          <div className="flex w-full flex-none items-start justify-between gap-4 border-b border-solid border-neutral-border bg-white px-6 py-4">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-heading-3 font-heading-3 text-default-font">
                  {title}
                </span>
                {titleAdornment}
              </div>
              {subtitle ? (
                <span className="text-sm text-gray-500">{subtitle}</span>
              ) : null}
            </div>
            <IconButton
              icon={<FeatherX />}
              onClick={() => handleOpenChange(false)}
              aria-label="Close details"
            />
          </div>
          <div
            className={`flex w-full grow shrink-0 basis-0 flex-col items-start gap-4 overflow-y-auto px-6 py-6${bodyClassName ? ` ${bodyClassName}` : ""}`}
          >
            {children}
          </div>
        </div>
      </Drawer.Content>
    </Drawer>
  );
}
