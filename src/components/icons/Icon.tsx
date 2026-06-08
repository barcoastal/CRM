import * as React from "react";
import { GLYPH_PATHS, type GlyphName } from "./glyphs-data";

export type IconProps = Omit<React.SVGProps<SVGSVGElement>, "name"> & {
  size?: number | string;
  strokeWidth?: number | string;
};

/**
 * Core glyph renderer for the custom Coastal playful icon set. Renders the
 * inner markup for `name` inside a 24x24 stroke="currentColor" svg, so icons
 * inherit text color and can be sized by `size` prop or Tailwind h-/w- classes.
 */
export const Icon = React.forwardRef<SVGSVGElement, IconProps & { name: GlyphName }>(
  ({ name, size = 24, strokeWidth = 2, className, ...rest }, ref) => {
    const inner = GLYPH_PATHS[name] ?? "";
    return (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
        {...rest}
        dangerouslySetInnerHTML={{ __html: inner }}
      />
    );
  }
);
Icon.displayName = "Icon";

/** Factory: a fixed-name component, drop-in compatible with a lucide icon. */
export function makeGlyph(name: GlyphName) {
  const C = React.forwardRef<SVGSVGElement, IconProps>((props, ref) => (
    <Icon ref={ref} name={name} {...props} />
  ));
  C.displayName = name;
  return C;
}
