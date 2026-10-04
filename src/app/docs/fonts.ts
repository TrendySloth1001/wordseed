// The documentation reads like a book with notes in the margin: a warm serif
// for the text and a handwriting face for the thoughts. Self-hosted by Next.js,
// so they also work offline.
import { Caveat, Newsreader } from "next/font/google";

export const reading = Newsreader({ subsets: ["latin"], variable: "--font-reading", display: "swap" });
export const handwriting = Caveat({ subsets: ["latin"], variable: "--font-hand", display: "swap" });
