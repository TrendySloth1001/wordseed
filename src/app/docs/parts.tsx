// Building blocks for the documentation page. All render on the server.
import katex from "katex";
import Image, { type StaticImageData } from "next/image";
import { HugeiconsIcon } from "@hugeicons/react";
import { FileScriptIcon, PencilEdit02Icon, SourceCodeIcon } from "@hugeicons/core-free-icons";
import { entry } from "./contents";

/** A formula typeset by KaTeX; `block` puts it on its own line. */
export function Tex({ children, block }: { children: string; block?: boolean }) {
  const html = katex.renderToString(children, { displayMode: block, throwOnError: false });
  return block ? (
    <div className="my-3 overflow-x-auto py-1" dangerouslySetInnerHTML={{ __html: html }} />
  ) : (
    <span dangerouslySetInnerHTML={{ __html: html }} />
  );
}

/** One numbered section, headed by its icon (see contents.ts). Transparent, like the rest of the page. */
export function Section({ id, children }: { id: string; children: React.ReactNode }) {
  const { title, icon, number } = entry(id);
  return (
    <section
      id={id}
      className="flex scroll-mt-20 flex-col gap-4 border-t pt-10 first-of-type:border-t-0 first-of-type:pt-0"
    >
      <header className="mb-1 flex items-center gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-foreground/30">
          <HugeiconsIcon icon={icon} strokeWidth={1.8} className="size-6" />
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="text-[0.7rem] font-semibold tracking-[0.18em] text-muted-foreground uppercase tabular-nums">
            Section {String(number).padStart(2, "0")}
          </span>
          <h2 className="font-sans text-2xl font-semibold tracking-tight">{title}</h2>
        </span>
      </header>
      {children}
    </section>
  );
}

export function Sub({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="flex items-center gap-2.5 pt-3 font-sans text-lg font-semibold">
      <span className="h-5 w-1 shrink-0 rounded-full bg-foreground" aria-hidden />
      {children}
    </h3>
  );
}

/** Where the idea lives in the code. */
export function InCode({ file, children }: { file: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border px-4 py-3 text-sm">
      <p className="mb-1 flex items-center gap-2 font-medium">
        <HugeiconsIcon icon={SourceCodeIcon} strokeWidth={2} className="size-4 shrink-0" />
        In the code · <code className="font-mono text-[0.85em]">{file}</code>
      </p>
      <div className="text-muted-foreground [&_code]:font-mono [&_code]:text-[0.9em] [&_code]:text-foreground">
        {children}
      </div>
    </div>
  );
}

export function Code({ file, children }: { file: string; children: string }) {
  return (
    <figure className="overflow-hidden rounded-xl border">
      <figcaption className="flex items-center gap-2 border-b px-4 py-2 text-xs text-muted-foreground">
        <HugeiconsIcon icon={FileScriptIcon} strokeWidth={2} className="size-4 shrink-0" />
        <code className="font-mono text-foreground">{file}</code>
        <span className="ml-auto">simplified</span>
      </figcaption>
      <pre className="overflow-x-auto p-4 font-mono text-[0.8rem] leading-6">
        <code>{children.trim()}</code>
      </pre>
    </figure>
  );
}

/** A reference image from the web, shown in greyscale with its credit. */
export function WebFigure({
  image,
  alt,
  caption,
  credit,
  source,
  license,
  licenseUrl,
}: {
  image: StaticImageData;
  alt: string;
  caption: string;
  credit: string;
  source: string;
  license: string;
  licenseUrl: string;
}) {
  return (
    <figure className="flex flex-col gap-2">
      <div className="rounded-lg border bg-white p-3">
        <Image src={image} alt={alt} className="mx-auto h-auto max-h-80 w-auto grayscale" sizes="(min-width: 768px) 720px, 100vw" />
      </div>
      <figcaption className="text-xs text-muted-foreground">
        {caption} Image by {credit},{" "}
        <a href={source} className="underline underline-offset-2">
          Wikimedia Commons
        </a>
        ,{" "}
        <a href={licenseUrl} className="underline underline-offset-2">
          {license}
        </a>
        ; shown in greyscale.
      </figcaption>
    </figure>
  );
}

export function Figure({ caption, children }: { caption: string; children: React.ReactNode }) {
  return (
    <figure className="flex flex-col gap-2">
      <div className="overflow-x-auto rounded-lg border p-4">{children}</div>
      <figcaption className="text-xs text-muted-foreground">{caption}</figcaption>
    </figure>
  );
}

/** A token drawn as a small box. */
export function Chip({
  children,
  strong,
  muted,
  label,
}: {
  children: React.ReactNode;
  strong?: boolean;
  muted?: boolean;
  label?: React.ReactNode;
}) {
  return (
    <span className="inline-flex flex-col items-center gap-0.5">
      <span
        className={`rounded-md px-2 py-1 font-mono text-sm ${
          strong
            ? "bg-foreground text-background"
            : muted
              ? "border border-dashed text-muted-foreground"
              : "border"
        }`}
      >
        {children}
      </span>
      {label !== undefined && <span className="text-[0.65rem] text-muted-foreground tabular-nums">{label}</span>}
    </span>
  );
}

/**
 * A thought scribbled in the margin: why something was done, what went wrong,
 * or just a joke. Handwritten, slightly tilted, transparent like the page.
 */
export function Thought({ children, tilt = "left" }: { children: React.ReactNode; tilt?: "left" | "right" }) {
  return (
    <aside
      className={`my-1 flex gap-3 border-l-2 border-dashed border-foreground/40 py-1 pl-4 font-[family-name:var(--font-hand)] text-[1.35rem] leading-snug text-foreground/85 ${
        tilt === "left" ? "-rotate-[0.6deg]" : "rotate-[0.6deg]"
      }`}
    >
      <HugeiconsIcon icon={PencilEdit02Icon} strokeWidth={1.8} className="mt-1 size-5 shrink-0 opacity-70" />
      <p>{children}</p>
    </aside>
  );
}
