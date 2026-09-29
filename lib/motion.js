// v71 #45 -- one place that knows whether the person asked their device for
// less motion ("Reduce motion" on iPhone/Android/desktop).
//
// CSS handles animations and transitions (see the prefers-reduced-motion block in
// globals.css). It CANNOT handle scrolling the code asks to be smooth -- an
// explicit `behavior: "smooth"` in JavaScript overrides CSS -- so anything that
// scrolls should ask this file how:
//
//   el.scrollIntoView({ behavior: scrollBehavior(), block: "start" });
export function prefersReducedMotion() {
  return typeof window !== "undefined" && Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
}

// "auto" (an instant jump) when reduced motion is on, otherwise "smooth".
export function scrollBehavior() {
  return prefersReducedMotion() ? "auto" : "smooth";
}
