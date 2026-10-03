// Building blocks for the documentation page. All render on the server.
import katex from "katex";
import Image, { type StaticImageData } from "next/image";

/** A formula typeset by KaTeX; `block` puts it on its own line. */
export function Tex({ children, block }: { children: string; block?: boolean }) {
  const html = katex.renderToString(children, { displayMode: block, throwOnError: false });
  return block ? (
    <div className="my-3 overflow-x-auto py-1" dangerouslySetInnerHTML={{ __html: html }} />
  ) : (
    <span dangerouslySetInnerHTML={{ __html: html }} />
  );
}

export function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="flex scroll-mt-20 flex-col gap-4 border-t pt-10 first-of-type:border-t-0 first-of-type:pt-0">
      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

export function Sub({ children }: { children: React.ReactNode }) {
  return <h3 className="pt-2 text-lg font-semibold">{children}</h3>;
}

/** Where the idea lives in the code. */
export function InCode({ file, children }: { file: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm">
      <p className="mb-1 font-medium">
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
    <figure className="flex flex-col gap-1">
      <pre className="overflow-x-auto rounded-lg border bg-muted/40 p-4 font-mono text-[0.8rem] leading-6">
        <code>{children.trim()}</code>
      </pre>
      <figcaption className="text-xs text-muted-foreground">
        Simplified from <code className="font-mono">{file}</code>
      </figcaption>
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
