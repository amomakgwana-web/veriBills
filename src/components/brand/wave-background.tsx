import Image from "next/image";

/**
 * Deep-blue backdrop with looping white wave bands, echoing the crossing
 * wave shape in the veriBills icon. Pure CSS/SVG — no client JS — so it can
 * sit behind a Server Component page like /login without a "use client"
 * boundary. Each band is a single tile repeated twice and scrolled by
 * exactly one tile-width, which is what makes the loop seamless.
 */
export function WaveBackground() {
  return (
    <div
      aria-hidden="true"
      className="from-brand-950 via-brand-800 to-brand-600 fixed inset-0 -z-10 overflow-hidden bg-gradient-to-br"
    >
      <Image
        src="/images/veribills-icon.png"
        alt=""
        width={900}
        height={900}
        priority
        className="absolute -top-24 -right-24 h-[32rem] w-[32rem] opacity-[0.07] select-none sm:h-[42rem] sm:w-[42rem]"
      />

      <WaveLayer top="8%" height="14rem" opacity={0.07} duration="26s" />
      <WaveLayer top="34%" height="18rem" opacity={0.1} duration="34s" reverse />
      <WaveLayer top="62%" height="16rem" opacity={0.08} duration="20s" />
      <WaveLayer top="86%" height="20rem" opacity={0.14} duration="30s" reverse />
    </div>
  );
}

function WaveLayer({
  top,
  height,
  opacity,
  duration,
  reverse,
}: {
  top: string;
  height: string;
  opacity: number;
  duration: string;
  reverse?: boolean;
}) {
  return (
    <div
      className={`wave-layer ${reverse ? "wave-layer-reverse" : ""}`}
      style={{ top, height, animationDuration: duration }}
    >
      <svg
        viewBox="0 0 2880 120"
        preserveAspectRatio="none"
        className="h-full w-full"
        style={{ opacity }}
      >
        <path
          fill="#ffffff"
          d="M0,60 C120,20 240,100 360,60 C480,20 600,100 720,60 C840,20 960,100 1080,60 C1200,20 1320,100 1440,60 L1440,120 L0,120 Z"
        />
        <path
          fill="#ffffff"
          d="M1440,60 C1560,20 1680,100 1800,60 C1920,20 2040,100 2160,60 C2280,20 2400,100 2520,60 C2640,20 2760,100 2880,60 L2880,120 L1440,120 Z"
        />
      </svg>
    </div>
  );
}
