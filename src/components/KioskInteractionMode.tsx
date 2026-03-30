"use client";

import { useEffect } from "react";

export function KioskInteractionMode() {
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;

    const preventContextMenu = (event: MouseEvent) => {
      event.preventDefault();
    };

    html.classList.add("kiosk-lock");
    body.classList.add("kiosk-lock");
    document.addEventListener("contextmenu", preventContextMenu);

    return () => {
      html.classList.remove("kiosk-lock");
      body.classList.remove("kiosk-lock");
      document.removeEventListener("contextmenu", preventContextMenu);
    };
  }, []);

  return null;
}
