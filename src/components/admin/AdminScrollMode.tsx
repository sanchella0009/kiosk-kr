"use client";

import { useEffect } from "react";

export function AdminScrollMode() {
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;

    html.classList.add("admin-scroll");
    body.classList.add("admin-scroll");

    return () => {
      html.classList.remove("admin-scroll");
      body.classList.remove("admin-scroll");
    };
  }, []);

  return null;
}
