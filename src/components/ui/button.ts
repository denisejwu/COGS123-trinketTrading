/**
 * Shared button styles. Use on <button> or <Link>:
 *   <button className={buttonClasses("primary")}>Save</button>
 */
const base =
  "inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold " +
  "transition-colors disabled:cursor-not-allowed disabled:opacity-60";

const variants = {
  primary: "bg-accent text-white hover:bg-accent-dark",
  secondary: "border border-line bg-card text-navy hover:bg-accent-soft",
  ghost: "text-accent hover:bg-accent-soft",
  danger: "bg-danger text-white hover:opacity-90",
} as const;

export type ButtonVariant = keyof typeof variants;

export function buttonClasses(variant: ButtonVariant = "primary", extra = "") {
  return `${base} ${variants[variant]} ${extra}`.trim();
}
