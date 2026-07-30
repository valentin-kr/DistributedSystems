import { useEffect, useRef, useState } from "react";
import type { PointerEvent } from "react";

type ContextMenuState = {
  x: number;
  y: number;
  messageId: number;
  text: string;
};

type UseMessageContextMenuOptions = {
  onDeleteMessage: (messageId: number) => void | Promise<void>;
};

export function useMessageContextMenu({
  onDeleteMessage,
}: UseMessageContextMenuOptions) {
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const hideOnOutsidePointer = (event: globalThis.PointerEvent) => {
      if (
        contextMenu &&
        menuRef.current &&
        !menuRef.current.contains(event.target as Node)
      ) {
        setContextMenu(null);
      }
    };
    document.addEventListener("pointerdown", hideOnOutsidePointer);
    return () =>
      document.removeEventListener("pointerdown", hideOnOutsidePointer);
  }, [contextMenu]);

  function showContextMenu(
    event: PointerEvent<HTMLDivElement>,
    messageId: number,
    text: string,
  ) {
    const menuWidth = 130;
    const menuHeight = 88;
    setContextMenu({
      x: Math.min(event.clientX, window.innerWidth - menuWidth - 8),
      y: Math.min(event.clientY, window.innerHeight - menuHeight - 8),
      messageId,
      text,
    });
  }

  async function copyContextText() {
    if (contextMenu) {
      try {
        await navigator.clipboard.writeText(contextMenu.text);
      } catch {
        // Clipboard API may be unavailable in some demo browsers.
      }
    }
    setContextMenu(null);
  }

  async function deleteContextMessage() {
    if (contextMenu) {
      await onDeleteMessage(contextMenu.messageId);
    }
    setContextMenu(null);
  }

  return {
    contextMenu,
    menuRef,
    showContextMenu,
    copyContextText,
    deleteContextMessage,
  };
}
