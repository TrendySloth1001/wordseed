import { ImageResponse } from "next/og";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";

export const alt = `${SITE_NAME}: ${SITE_TAGLINE}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const QUILL = [
  "M5.07579 17C4.08939 4.54502 12.9123 1.0121 19.9734 2.22417C20.2585 6.35185 18.2389 7.89748 14.3926 8.61125C15.1353 9.38731 16.4477 10.3639 16.3061 11.5847C16.2054 12.4534 15.6154 12.8797 14.4355 13.7322C11.8497 15.6004 8.85421 16.7785 5.07579 17Z",
  "M4 22C4 15.5 7.84848 12.1818 10.5 10",
];

/** The card shown when a link to the site is shared: black and white, like the site. */
export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "#ffffff",
          color: "#0a0a0a",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div
            style={{
              width: 88,
              height: 88,
              borderRadius: 44,
              background: "#0a0a0a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {QUILL.map((d) => (
                <path key={d} d={d} />
              ))}
            </svg>
          </div>
          <div style={{ fontSize: 56, fontWeight: 700, letterSpacing: -2 }}>{SITE_NAME}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <div style={{ fontSize: 64, fontWeight: 700, letterSpacing: -2, lineHeight: 1.05, maxWidth: 980 }}>
            {`${SITE_TAGLINE}.`}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 12,
              fontSize: 34,
              color: "#404040",
              border: "2px solid #e5e5e5",
              borderRadius: 24,
              padding: "22px 30px",
            }}
          >
            <span>The old man crossed the</span>
            <span style={{ background: "#0a0a0a", color: "#ffffff", borderRadius: 12, padding: "2px 14px" }}>river</span>
            <span>at night.</span>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 26, color: "#737373" }}>
          <span>N-gram model + LSTM, built from scratch</span>
          <span>Free · open source</span>
        </div>
      </div>
    ),
    size,
  );
}
