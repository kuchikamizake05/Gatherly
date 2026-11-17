"use client";
import { useRef } from "react";

// Reuse one key when retrying the same financial intent after a lost response.
export function useIdempotencyKey() {
  const previous = useRef<{ signature: string; key: string } | null>(null);
  return (input: unknown) => {
    const signature = JSON.stringify(input);
    if (previous.current?.signature !== signature)
      previous.current = { signature, key: crypto.randomUUID() };
    return previous.current.key;
  };
}
