"use client";

import { useEffect, useRef, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowUpRight01Icon } from "@hugeicons/core-free-icons";
import { GithubMark, StarBurstIcon } from "@/components/animated-icons";
import { FLYOUT_EVENT, type FlyoutBox } from "@/components/site-nav";

const AUTHOR = "Nikhil Kumawat";
const LOGIN = "TrendySloth1001";
const PROFILE = `https://github.com/${LOGIN}`;
const REPO = `${LOGIN}/wordseed`;

type Repo = { stargazers_count: number };
type User = {
  avatar_url: string;
  name: string | null;
  bio: string | null;
  public_repos: number;
  followers: number;
  following: number;
};

/**
 * A GitHub API resource, fetched once per browser session and cached; null
 * until it arrives, or for good when GitHub cannot be reached.
 */
function useGitHub<T>(path: string): T | null {
  const [data, setData] = useState<T | null>(null);
  useEffect(() => {
    const key = `wordseed-github:${path}`;
    try {
      const saved = sessionStorage.getItem(key);
      if (saved !== null) {
        queueMicrotask(() => setData(JSON.parse(saved)));
        return;
      }
    } catch {}
    fetch(`https://api.github.com/${path}`, { signal: AbortSignal.timeout(5000) })
      .then((response) => (response.ok ? response.json() : null))
      .then((value) => {
        if (!value) return;
        setData(value);
        try {
          sessionStorage.setItem(key, JSON.stringify(value));
        } catch {}
      })
      .catch(() => {});
  }, [path]);
  return data;
}

/**
 * How far to slide an element left so it clears the Settings slide-out, which
 * opens to the left of the floating nav in the bottom-right corner. Zero while
 * the slide-out is closed or nowhere near the element.
 */
function useClearOfFlyout() {
  const element = useRef<HTMLDivElement>(null);
  const [shift, setShift] = useState(0);
  const current = useRef(0);

  useEffect(() => {
    const onFlyout = (event: Event) => {
      const flyout = (event as CustomEvent<FlyoutBox | null>).detail;
      const box = element.current?.getBoundingClientRect();
      let next = 0;
      if (flyout && box) {
        // Where the element sits without the current shift.
        const right = box.right + current.current;
        const level = box.bottom > flyout.top - 8 && box.top < flyout.bottom + 8;
        next = level ? Math.max(0, right - flyout.left + 12) : 0;
      }
      current.current = next;
      setShift(next);
    };
    window.addEventListener(FLYOUT_EVENT, onFlyout);
    return () => window.removeEventListener(FLYOUT_EVENT, onFlyout);
  }, []);

  return { element, shift };
}

/** The author's name; hovering or focusing it shows their GitHub profile above. */
function Author() {
  const user = useGitHub<User>(`users/${LOGIN}`);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const initials = AUTHOR.split(" ").map((part) => part[0]).join("");
  const stats = user
    ? [
        [user.public_repos, "repos"],
        [user.followers, "followers"],
        [user.following, "following"],
      ]
    : [];

  return (
    // On a phone the card is placed against the footer (full width, so it can
    // never reach past the screen); on larger screens it is centred on the name.
    <span className="group/author inline-block sm:relative">
      <a
        href={PROFILE}
        className="font-medium text-foreground underline-offset-4 outline-none hover:underline focus-visible:underline"
      >
        {AUTHOR}
      </a>
      {/* The bottom padding bridges the gap, so the pointer can move up into the card. */}
      <span className="pointer-events-none absolute inset-x-4 bottom-full z-40 translate-y-1 pb-3 opacity-0 transition-all duration-200 group-hover/author:pointer-events-auto group-hover/author:translate-y-0 group-hover/author:opacity-100 group-has-focus-visible/author:pointer-events-auto group-has-focus-visible/author:translate-y-0 group-has-focus-visible/author:opacity-100 sm:inset-x-auto sm:left-1/2 sm:w-72 sm:-translate-x-1/2">
        <a
          href={PROFILE}
          tabIndex={-1}
          className="flex flex-col gap-3 rounded-2xl border bg-background/95 p-4 text-left shadow-xl shadow-black/15 backdrop-blur-md dark:shadow-black/50"
        >
          <span className="flex items-center gap-3">
            <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-muted font-semibold text-foreground">
              {user?.avatar_url && !avatarFailed ? (
                // A small avatar from GitHub; initials stand in when it cannot load.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`${user.avatar_url}&s=96`}
                  alt=""
                  width={48}
                  height={48}
                  className="size-full object-cover grayscale"
                  onError={() => setAvatarFailed(true)}
                />
              ) : (
                initials
              )}
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="truncate font-semibold text-foreground">{user?.name ?? AUTHOR}</span>
              <span className="truncate text-xs text-muted-foreground">@{LOGIN}</span>
            </span>
          </span>
          {user?.bio && <span className="text-sm text-muted-foreground">{user.bio}</span>}
          {stats.length > 0 && (
            <span className="flex gap-4 text-xs text-muted-foreground">
              {stats.map(([value, label]) => (
                <span key={label}>
                  <span className="font-semibold text-foreground tabular-nums">{value.toLocaleString("en")}</span>{" "}
                  {label}
                </span>
              ))}
            </span>
          )}
          <span className="flex items-center justify-center gap-1.5 rounded-full bg-foreground py-2 text-sm font-medium text-background">
            View profile on GitHub
            <HugeiconsIcon icon={ArrowUpRight01Icon} strokeWidth={2} className="size-4" />
          </span>
        </a>
      </span>
    </span>
  );
}

/** Who made it, and floating links to the code on GitHub. */
export function SiteFooter() {
  const stars = useGitHub<Repo>(`repos/${REPO}`)?.stargazers_count ?? null;
  const { element, shift } = useClearOfFlyout();
  // The same height as the Settings slide-out (50px) and, with the footer's
  // 24px bottom padding, centred on the same line once scrolled to the bottom.
  const bubble =
    "group flex h-[50px] items-center justify-center gap-1.5 rounded-full border bg-background/85 text-sm font-medium shadow-lg shadow-black/10 backdrop-blur-md transition-all duration-200 outline-none hover:-translate-y-0.5 hover:bg-foreground hover:text-background focus-visible:ring-2 focus-visible:ring-ring dark:shadow-black/40";

  return (
    <footer className="relative mx-auto flex w-full max-w-[90rem] flex-wrap items-center justify-between gap-4 px-4 pt-10 pb-6 print:hidden">
      <p className="text-sm text-muted-foreground">
        Built from scratch by <Author />
        <span className="hidden lg:inline"> · open source under the MIT licence</span>
      </p>
      <div
        ref={element}
        className="flex items-center gap-2 transition-transform duration-300 ease-out"
        style={shift ? { transform: `translateX(-${shift}px)` } : undefined}
      >
        <a href={`https://github.com/${REPO}`} aria-label="Source code on GitHub" title="Source code on GitHub" className={`${bubble} w-[50px]`}>
          <GithubMark className="size-5" />
        </a>
        <a
          href={`https://github.com/${REPO}/stargazers`}
          aria-label={stars ? `Star on GitHub, ${stars} stars so far` : "Star on GitHub"}
          title="Star on GitHub"
          className={`${bubble} px-4`}
        >
          <StarBurstIcon className="size-5" />
          Star
          {stars !== null && stars > 0 && (
            <span className="border-l pl-1.5 tabular-nums group-hover:border-background/30">{stars.toLocaleString("en")}</span>
          )}
        </a>
      </div>
    </footer>
  );
}
