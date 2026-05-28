/**
 * Logo — iPassion brand mark for the topbar.
 * Square blue tile + "iP" wordmark — derived from the iPassion logo asset.
 */

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label="iPassion"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="100" height="100" rx="14" fill="var(--color-primary)" />
      <text
        x="50"
        y="56"
        textAnchor="middle"
        dominantBaseline="middle"
        fontFamily="Inter, sans-serif"
        fontSize="46"
        fontWeight="600"
        letterSpacing="-2"
        fill="var(--color-on-primary)"
      >
        iP
      </text>
    </svg>
  );
}
