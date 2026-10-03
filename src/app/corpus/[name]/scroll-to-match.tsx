"use client";

import { useEffect } from "react";

/** Brings the highlighted passage into view once the page has rendered. */
export function ScrollToMatch() {
  useEffect(() => {
    // Wait a frame: the router restores its own scroll position first.
    const frame = requestAnimationFrame(() =>
      document.getElementById("match")?.scrollIntoView({ block: "center" }),
    );
    return () => cancelAnimationFrame(frame);
  }, []);
  return null;
}
