import Image from "next/image";

import { cx } from "@/components/ui";

const SIZES = { sm: 32, md: 44 } as const;

/** The veriBills icon mark. The source PNG already carries its blue tile. */
export function LogoMark({
  size = "sm",
  className,
}: {
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const px = SIZES[size];

  return (
    <Image
      src="/images/veribills-icon.png"
      alt="veriBills"
      width={px}
      height={px}
      priority
      className={cx("shrink-0 rounded-xl", className)}
    />
  );
}
