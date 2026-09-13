// Bible verse tags don't have a color picker -- each tag is auto-assigned a
// consistent color based on its text, so the same tag always looks the same
// wherever it appears, and different tags are visually easy to tell apart.
// Returns a CSS class name (defined in globals.css with light/dark variants)
// rather than raw color values, so contrast stays correct in both themes.

const TAG_CLASS_COUNT = 7;

export function tagColorClass(tag, variant = "") {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = (hash << 5) - hash + tag.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % TAG_CLASS_COUNT;
  return variant ? `tag-color-${index}-${variant}` : `tag-color-${index}`;
}

