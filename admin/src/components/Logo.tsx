type LogoProps = {
  className?: string
  title?: string
}

/** Brand mark from `public/brand-logo.svg` (your whoami_logo artwork). */
export default function Logo({ className = 'h-16 w-16', title = 'Who Am I?' }: LogoProps) {
  return (
    <img
      src="/brand-logo.svg"
      alt={title}
      className={className}
      width={522}
      height={532}
      decoding="async"
    />
  )
}
