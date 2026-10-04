import Link from "next/link";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";

/** A plain-language policy page: title, date, and numbered sections with icons. */
export function LegalPage({
  icon,
  title,
  intro,
  updated,
  other,
  children,
}: {
  icon: IconSvgElement;
  title: string;
  intro: string;
  updated: string;
  other: { href: string; label: string };
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-4 py-6 leading-7 sm:py-10">
      <header className="flex flex-col gap-4">
        <span className="flex size-12 items-center justify-center rounded-2xl border border-foreground/30">
          <HugeiconsIcon icon={icon} strokeWidth={1.8} className="size-6" />
        </span>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
        <p className="text-lg text-muted-foreground">{intro}</p>
        <p className="text-sm text-muted-foreground">
          Last updated {updated} · See also the{" "}
          <Link href={other.href} className="underline underline-offset-4">
            {other.label}
          </Link>
          .
        </p>
      </header>
      {children}
    </main>
  );
}

export function Clause({ icon, title, children }: { icon: IconSvgElement; title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-t pt-8 [&_li]:ml-5 [&_li]:list-disc [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1.5">
      <h2 className="flex items-center gap-3 text-xl font-semibold tracking-tight">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-foreground/30">
          <HugeiconsIcon icon={icon} strokeWidth={2} className="size-[18px]" />
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}
