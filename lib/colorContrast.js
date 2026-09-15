// Ministries can pick any hex color for their tile, including very light
// ones (pale yellow, etc.) where white text would be unreadable. This
// picks black or white text based on the background's actual luminance,
// using the standard relative-luminance formula, rather than assuming
// white always works.
export function readableTextColor(hexColor) {
  if (!hexColor) return "#fff";
  const hex = hexColor.replace("#", "");
  if (hex.length !== 6) return "#fff";
  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.6 ? "#1a1a1a" : "#fff";
}
