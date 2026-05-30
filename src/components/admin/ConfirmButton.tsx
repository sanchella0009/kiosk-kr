"use client";

import React from "react";

type Props = {
  className?: string;
  type?: "submit" | "button";
  style?: React.CSSProperties;
  message?: string;
  children: React.ReactNode;
};

export function ConfirmButton({
  className,
  type = "submit",
  style,
  message,
  children,
}: Props) {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (message && !confirm(message)) {
      e.preventDefault();
    }
  };

  return (
    <button
      className={className}
      type={type}
      style={style}
      onClick={handleClick}
    >
      {children}
    </button>
  );
}
