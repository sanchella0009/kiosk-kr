"use client";

import { useRef, useState } from "react";

type Props = {
  onKeyPress: (value: string) => void;
  onBackspace: () => void;
  onSpace: () => void;
  onHide: () => void;
  onInteractStart?: () => void;
  onInteractEnd?: () => void;
};

const rowsRu = [
  ["й", "ц", "у", "к", "е", "н", "г", "ш", "щ", "з", "х", "ъ"],
  ["ф", "ы", "в", "а", "п", "р", "о", "л", "д", "ж", "э"],
  ["я", "ч", "с", "м", "и", "т", "ь", "б", "ю"],
];

const rowsEn = [
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
  ["z", "x", "c", "v", "b", "n", "m"],
];

const rowsNum = [
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
  ["-", "_", "=", "+", "(", ")", "/", "\\", ":", ";"],
  [".", ",", "!", "?", "@", "#", "$", "%", "&"],
];

export function Keyboard({
  onKeyPress,
  onBackspace,
  onSpace,
  onHide,
  onInteractStart,
  onInteractEnd,
}: Props) {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [shift, setShift] = useState(false);
  const [layout, setLayout] = useState<"ru" | "en" | "num">("ru");
  const dragState = useRef<{
    active: boolean;
    offsetX: number;
    offsetY: number;
  }>({ active: false, offsetX: 0, offsetY: 0 });

  const onPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);
    dragState.current.active = true;
    dragState.current.offsetX = event.clientX - position.x;
    dragState.current.offsetY = event.clientY - position.y;
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState.current.active) return;
    const x = event.clientX - dragState.current.offsetX;
    const y = event.clientY - dragState.current.offsetY;
    setPosition({
      x: Math.max(-300, Math.min(300, x)),
      y: Math.max(-240, Math.min(240, y)),
    });
  };

  const onPointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragState.current.active) return;
    dragState.current.active = false;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
    <div
      className="keyboard"
      style={{ transform: `translate(calc(-50% + ${position.x}px), ${position.y}px)` }}
      onPointerMove={onPointerMove}
      onPointerDownCapture={onInteractStart}
      onPointerUp={onInteractEnd}
    >
      <button className="keyboard-close" type="button" onClick={onHide}>
        ✕
      </button>
      {(layout === "ru" ? rowsRu : layout === "en" ? rowsEn : rowsNum).map(
        (row, rowIndex, rowsList) => (
        <div key={row.join("")} className="keyboard-row">
          {rowIndex === rowsList.length - 1 ? (
            <button
              className="key"
              type="button"
              onClick={() => setShift((prev) => !prev)}
            >
              Shift {shift ? "↑" : ""}
            </button>
          ) : null}
          {row.map((key) => (
            <button
              key={key}
              className="key"
              type="button"
              onClick={() => {
                const value = shift ? key.toUpperCase() : key;
                onKeyPress(value);
                if (shift) setShift(false);
              }}
            >
              {shift ? key.toUpperCase() : key}
            </button>
          ))}
          {rowIndex === rowsList.length - 1 ? (
            <button className="key" type="button" onClick={onBackspace}>
              ←
            </button>
          ) : null}
        </div>
      ))}
      <div className="keyboard-row">
        <button
          className="key"
          type="button"
          onClick={() =>
            setLayout((prev) => (prev === "ru" ? "en" : "ru"))
          }
        >
          {layout === "ru" ? "EN" : "РУ"}
        </button>
        <button
          className="key"
          type="button"
          onClick={() =>
            setLayout((prev) => (prev === "num" ? "ru" : "num"))
          }
        >
          {layout === "num" ? "ABC" : "123"}
        </button>
        <button className="key" type="button" onClick={onSpace}>
          Пробел
        </button>
      </div>
      <button
        className="keyboard-handle"
        type="button"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
      >
        ⬍ перетащить
      </button>
    </div>
  );
}
