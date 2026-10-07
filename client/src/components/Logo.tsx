type LogoProps = {
  className?: string
  /** Accessible name. Pass empty string when the mark is decorative (e.g. letter-O lockup). */
  title?: string
}

/** Brand mark from `public/brand-logo.svg` (your whoami_logo artwork). */
export default function Logo({ className = 'h-16 w-16', title = 'Who Am I?' }: LogoProps) {
  const decorative = title.length === 0
  return (
    <img
      src="/brand-logo.svg"
      alt={decorative ? '' : title}
      aria-hidden={decorative || undefined}
      className={className}
      width={522}
      height={532}
      decoding="async"
    />
  )
}
