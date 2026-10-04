// Icons whose parts move on their own, instead of the whole icon moving. Each
// plays when its link is hovered or focused (any ancestor with the `group`
// class) and once when its page becomes the current one. Shapes follow
// Hugeicons (24px grid, round caps); the keyframes live in globals.css.
type IconProps = { className?: string };

function Svg({ name, className, children }: IconProps & { name: string; children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={`ai ai-${name} ${className ?? ""}`}
    >
      {children}
    </svg>
  );
}

/** Generate: the big sparkle turns and pulses while small ones pop in after it. */
export function GenerateIcon(props: IconProps) {
  return (
    <Svg name="generate" {...props}>
      <path
        className="ai-part ai-star-main"
        d="M15 2L15.5387 4.39157C15.9957 6.42015 17.5798 8.00431 19.6084 8.46127L22 9L19.6084 9.53873C17.5798 9.99569 15.9957 11.5798 15.5387 13.6084L15 16L14.4613 13.6084C14.0043 11.5798 12.4202 9.99569 10.3916 9.53873L8 9L10.3916 8.46127C12.4201 8.00431 14.0043 6.42015 14.4613 4.39158L15 2Z"
      />
      <path
        className="ai-part ai-star-small"
        d="M7 12L7.38481 13.7083C7.71121 15.1572 8.84275 16.2888 10.2917 16.6152L12 17L10.2917 17.3848C8.84275 17.7112 7.71121 18.8427 7.38481 20.2917L7 22L6.61519 20.2917C6.28879 18.8427 5.15725 17.7112 3.70827 17.3848L2 17L3.70827 16.6152C5.15725 16.2888 6.28879 15.1573 6.61519 13.7083L7 12Z"
      />
      {/* A glint that only exists while the animation plays. */}
      <path className="ai-part ai-star-glint" d="M19.5 17.5v3M18 19h3" />
      <path className="ai-part ai-star-glint ai-star-glint-2" d="M4.5 4.5v2M3.5 5.5h2" />
    </Svg>
  );
}

/** History: the clock's hands sweep round; the face stays still. */
export function HistoryIcon(props: IconProps) {
  return (
    <Svg name="history" {...props}>
      <circle cx="12" cy="12" r="10" />
      <path className="ai-part ai-hand-minute" d="M12 12V7" />
      <path className="ai-part ai-hand-hour" d="M12 12L14.5 14.5" />
    </Svg>
  );
}

/** Corpus: a stack of books; a new one drops onto it and the stack settles. */
export function CorpusIcon(props: IconProps) {
  return (
    <Svg name="corpus" {...props}>
      <g className="ai-part ai-book ai-book-1">
        <rect x="3" y="16.5" width="18" height="4.5" rx="1.2" />
        <path d="M6.5 16.5v4.5" />
      </g>
      <g className="ai-part ai-book ai-book-2">
        <rect x="5" y="11.5" width="15" height="4.5" rx="1.2" />
        <path d="M16.5 11.5v4.5" />
      </g>
      <g className="ai-part ai-book ai-book-3">
        <rect x="4" y="6.5" width="13.5" height="4.5" rx="1.2" />
        <path d="M7.5 6.5v4.5" />
      </g>
      <g className="ai-part ai-book-new">
        <rect x="6" y="1.5" width="12" height="4.5" rx="1.2" />
        <path d="M14.5 1.5v4.5" />
      </g>
    </Svg>
  );
}

/** Docs: an open book whose right-hand page turns over the spine. */
export function DocsIcon(props: IconProps) {
  const right =
    "M16.0001 3.5H17.3997C19.5681 3.5 20.6523 3.5 21.3259 4.17362C21.9996 4.84724 21.9996 5.93144 21.9997 8.09982L21.9999 13.3998C22 15.5684 22 16.6526 21.3264 17.3263C20.6527 18 19.5684 18 17.3999 18H15.0495C13.567 18 12.2907 19.0464 12 20.5V5.5C12.9443 4.24097 14 3.5 16.0001 3.5Z";
  return (
    <Svg name="docs" {...props}>
      <path d="M7.99978 3.5H6.60021C4.43183 3.5 3.34764 3.5 2.67399 4.17362C2.00034 4.84724 2.00029 5.93144 2.00021 8.09982L2 13.3998C1.99992 15.5684 1.99987 16.6526 2.67353 17.3263C3.34719 18 4.43146 18 6.6 18H8.95042C10.4329 18 11.7092 19.0464 11.9999 20.5V5.5C11.0556 4.24097 9.99989 3.5 7.99978 3.5Z" />
      <path d={right} />
      {/* Two loose pages that turn one after the other. */}
      <path className="ai-part ai-page" d={right} />
      <path className="ai-part ai-page ai-page-2" d={right} />
    </Svg>
  );
}

/** GitHub: the mark draws itself again, and the cat's tail gives a flick. */
export function GithubMark(props: IconProps) {
  return (
    <Svg name="github" {...props}>
      <path className="ai-part ai-tail" pathLength={1} d="M10 20.5675C6.57143 21.7248 3.71429 20.5675 2 17" />
      <path
        className="ai-part ai-cat"
        pathLength={1}
        d="M10 22V18.7579C10 18.1596 10.1839 17.6396 10.4804 17.1699C10.6838 16.8476 10.5445 16.3904 10.1771 16.2894C7.13394 15.4528 5 14.1077 5 9.64606C5 8.48611 5.38005 7.39556 6.04811 6.4464C6.21437 6.21018 6.29749 6.09208 6.31748 5.9851C6.33746 5.87813 6.30272 5.73852 6.23322 5.45932C5.95038 4.32292 5.96871 3.11619 6.39322 2.02823C6.39322 2.02823 7.27042 1.74242 9.26698 2.98969C9.72282 3.27447 9.95075 3.41686 10.1515 3.44871C10.3522 3.48056 10.6206 3.41384 11.1573 3.28041C11.8913 3.09795 12.6476 3 13.5 3C14.3524 3 15.1087 3.09795 15.8427 3.28041C16.3794 3.41384 16.6478 3.48056 16.8485 3.44871C17.0493 3.41686 17.2772 3.27447 17.733 2.98969C19.7296 1.74242 20.6068 2.02823 20.6068 2.02823C21.0313 3.11619 21.0496 4.32292 20.7668 5.45932C20.6973 5.73852 20.6625 5.87813 20.6825 5.9851C20.7025 6.09207 20.7856 6.21019 20.9519 6.4464C21.6199 7.39556 22 8.48611 22 9.64606C22 14.1077 19.8661 15.4528 16.8229 16.2894C16.4555 16.3904 16.3162 16.8476 16.5196 17.1699C16.8161 17.6396 17 18.1596 17 18.7579V22"
      />
    </Svg>
  );
}

/** The project's quill: it writes, leaving a line of ink that then fades. */
export function QuillIcon(props: IconProps) {
  return (
    <Svg name="quill" {...props}>
      <g className="ai-part ai-quill">
        <path d="M5.07579 17C4.08939 4.54502 12.9123 1.0121 19.9734 2.22417C20.2585 6.35185 18.2389 7.89748 14.3926 8.61125C15.1353 9.38731 16.4477 10.3639 16.3061 11.5847C16.2054 12.4534 15.6154 12.8797 14.4355 13.7322C11.8497 15.6004 8.85421 16.7785 5.07579 17Z" />
        <path d="M4 22C4 15.5 7.84848 12.1818 10.5 10" />
      </g>
      <path className="ai-part ai-ink" pathLength={1} d="M4 22c2.5-1.2 4 .8 6.5-.4S15 20.8 19 21" />
    </Svg>
  );
}

/** Star: it spins one point's turn, fills in, and a ring of short rays bursts out. */
export function StarBurstIcon(props: IconProps) {
  return (
    <Svg name="star" {...props}>
      <path className="ai-part ai-rays" d="M18.35 3.76L19.82 1.74 M22.27 15.84L24.65 16.61 M12.00 23.30L12.00 25.80 M1.73 15.84L-0.65 16.61 M5.65 3.76L4.18 1.74" />
      <path
        className="ai-part ai-star-shape"
        d="M13.7276 3.44418L15.4874 6.99288C15.7274 7.48687 16.3673 7.9607 16.9073 8.05143L20.0969 8.58575C22.1367 8.92853 22.6167 10.4206 21.1468 11.8925L18.6671 14.3927C18.2471 14.8161 18.0172 15.6327 18.1471 16.2175L18.8571 19.3125C19.417 21.7623 18.1271 22.71 15.9774 21.4296L12.9877 19.6452C12.4478 19.3226 11.5579 19.3226 11.0079 19.6452L8.01827 21.4296C5.8785 22.71 4.57865 21.7522 5.13859 19.3125L5.84851 16.2175C5.97849 15.6327 5.74852 14.8161 5.32856 14.3927L2.84884 11.8925C1.389 10.4206 1.85895 8.92853 3.89872 8.58575L7.08837 8.05143C7.61831 7.9607 8.25824 7.48687 8.49821 6.99288L10.258 3.44418C11.2179 1.51861 12.7777 1.51861 13.7276 3.44418Z"
      />
    </Svg>
  );
}

/** Light theme: the rays turn and pulse round a steady sun. */
export function SunIcon(props: IconProps) {
  return (
    <Svg name="sun" {...props}>
      <path d="M17 12C17 14.7614 14.7614 17 12 17C9.23858 17 7 14.7614 7 12C7 9.23858 9.23858 7 12 7C14.7614 7 17 9.23858 17 12Z" />
      <path
        className="ai-part ai-rays-sun"
        d="M12 2V3.5M12 20.5V22M19.0708 19.0713L18.0101 18.0106M5.98926 5.98926L4.9286 4.9286M22 12H20.5M3.5 12H2M19.0713 4.92871L18.0106 5.98937M5.98975 18.0107L4.92909 19.0714"
      />
    </Svg>
  );
}

/** Dark theme: the moon rocks while two small stars twinkle beside it. */
export function MoonIcon(props: IconProps) {
  return (
    <Svg name="moon" {...props}>
      <path
        className="ai-part ai-moon"
        d="M21.5 14.0784C20.3003 14.7189 18.9301 15.0821 17.4751 15.0821C12.7491 15.0821 8.91792 11.2509 8.91792 6.52485C8.91792 5.06986 9.28105 3.69968 9.92163 2.5C5.66765 3.49698 2.5 7.31513 2.5 11.8731C2.5 17.1899 6.8101 21.5 12.1269 21.5C16.6849 21.5 20.503 18.3324 21.5 14.0784Z"
      />
      <path className="ai-part ai-twinkle" d="M17 3.5v2M16 4.5h2" />
      <path className="ai-part ai-twinkle ai-twinkle-2" d="M20.5 8v1.6M19.7 8.8h1.6" />
    </Svg>
  );
}

/** System theme: the screen flickers on, half light, half dark. */
export function SystemIcon(props: IconProps) {
  return (
    <Svg name="system" {...props}>
      <path d="M16 3H8C5.17157 3 3.75736 3 2.87868 3.87868C2 4.75736 2 6.17157 2 9V11C2 13.8284 2 15.2426 2.87868 16.1213C3.75736 17 5.17157 17 8 17H16C18.8284 17 20.2426 17 21.1213 16.1213C22 15.2426 22 13.8284 22 11V9C22 6.17157 22 4.75736 21.1213 3.87868C20.2426 3 18.8284 3 16 3Z" />
      <path d="M8 21H16M12 17V21" />
      <path className="ai-part ai-screen" d="M12 6.5V13.5" />
      <path className="ai-part ai-screen-fill" d="M12.8 6.6C14.6 6.9 16 8.3 16 10S14.6 13.1 12.8 13.4Z" fill="currentColor" stroke="none" />
    </Svg>
  );
}

/** Offline: the cloud floats; saved, its tick draws itself, otherwise the arrow drops in. */
export function CloudIcon({ saved, ...props }: IconProps & { saved?: boolean }) {
  return (
    <Svg name="cloud" {...props}>
      <path
        className="ai-part ai-cloud"
        d="M17.4776 9.01106C17.485 9.01102 17.4925 9.01101 17.5 9.01101C19.9853 9.01101 22 11.0294 22 13.5193C22 15.8398 20.25 17.7508 18 18M17.4776 9.01106C17.4924 8.84606 17.5 8.67896 17.5 8.51009C17.5 5.46695 15.0376 3 12 3C9.12324 3 6.76233 5.21267 6.52042 8.03192M17.4776 9.01106C17.3753 10.1476 16.9286 11.1846 16.2428 12.0165M6.52042 8.03192C3.98398 8.27373 2 10.4139 2 13.0183C2 15.4417 3.71776 17.4632 6 17.9273M6.52042 8.03192C6.67826 8.01687 6.83823 8.00917 7 8.00917C8.12582 8.00917 9.16474 8.38194 10.0005 9.01101"
      />
      {saved ? (
        <path className="ai-part ai-tick" pathLength={1} d="M9 19C9 19 10 19 11 21C11 21 14.1765 16 17 15" />
      ) : (
        <path className="ai-part ai-arrow" d="M12 21L12 13M12 21C11.2998 21 9.99153 19.0057 9.5 18.5M12 21C12.7002 21 14.0085 19.0057 14.5 18.5" />
      )}
    </Svg>
  );
}

/** Cookies: always gently alive, wobbling while crumbs drop off it. */
export function CookieIcon(props: IconProps) {
  return (
    <Svg name="cookie" {...props}>
      <g className="ai-part ai-cookie">
        <path d="M12.0579 22C16.9725 22 21.0638 18.4937 21.9416 13.8586C22.1996 12.4967 21.5931 12.5686 20.3101 12.3438C19.3996 12.1844 18.5498 11.5667 18.2333 10.588C18.0178 9.9216 17.9376 9.89475 17.2352 9.86554C15.7861 9.80529 14.625 8.2689 15.2032 7.02602C15.419 6.56236 15.412 6.50892 15.0078 6.19448C14.3005 5.6443 13.9706 4.6166 14.0978 3.62604C14.2347 2.5591 14.3147 2.1747 13.1854 2.05455C7.45657 1.44501 2 6.0196 2 11.9948C2 17.5205 6.50308 22 12.0579 22Z" />
        <path d="M12.0078 18L11.9988 18M10 6L9 7M17 14L16 15M7 15L8 16M11 12h.01M6 10h.01" />
      </g>
      <path className="ai-part ai-crumb" d="M19 7.5h.01" />
      <path className="ai-part ai-crumb ai-crumb-2" d="M21 5h.01" />
    </Svg>
  );
}
