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
