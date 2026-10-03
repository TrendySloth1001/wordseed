"use client";

import { useEffect, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Delete02Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";

/**
 * A delete button that asks once before acting: the first press turns it into
 * a labelled "Delete?" button, which goes back to the icon after a few seconds.
 */
export function DeleteButton({
  label,
  disabled,
  onConfirm,
}: {
  label: string;
  disabled?: boolean;
  onConfirm: () => void;
}) {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(timer);
  }, [armed]);

  if (armed) {
    return (
      <Button size="lg" disabled={disabled} onClick={onConfirm} onBlur={() => setArmed(false)} autoFocus>
        <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} className="size-5" />
        Delete?
      </Button>
    );
  }
  return (
    <Button
      size="icon-lg"
      variant="ghost"
      disabled={disabled}
      aria-label={label}
      title={label}
      onClick={() => setArmed(true)}
    >
      <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} className="size-5" />
    </Button>
  );
}
