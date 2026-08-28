"use client";

import {useEffect, useRef, type RefObject} from "react";

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function focusableElements(container: HTMLElement) {
  return [...container.querySelectorAll<HTMLElement>(focusableSelector)].filter(
    (element) => element.getAttribute("aria-hidden") !== "true" && element.offsetParent !== null,
  );
}

export function useModalFocus<T extends HTMLElement>(
  active: boolean,
  onClose: () => void,
): RefObject<T | null> {
  const containerRef = useRef<T>(null);
  const closeRef = useRef(onClose);

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;
    const activeContainer: T = container;

    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusFrame = window.requestAnimationFrame(() => {
      const target =
        activeContainer.querySelector<HTMLElement>("[data-autofocus], [autofocus]") ??
        focusableElements(activeContainer)[0] ??
        activeContainer;
      target.focus();
    });

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = focusableElements(activeContainer);
      if (!focusable.length) {
        event.preventDefault();
        activeContainer.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable.at(-1)!;
      const current = document.activeElement;
      if (event.shiftKey && (current === first || !activeContainer.contains(current))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (current === last || !activeContainer.contains(current))) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [active]);

  return containerRef;
}
