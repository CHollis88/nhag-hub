"use client";

// A person's profile photo, or their initials on a soft colour when they
// haven't added one (v71.29). Decorative next to their name, so alt="".
const TINTS = ["#E8EEF9", "#FBE9E7", "#E8F5E9", "#FFF4E0", "#F1E8F7", "#E6F4F6"];
const INKS = ["#16296B", "#9B2C1F", "#2E6B34", "#8A5A00", "#5B2E7A", "#1F6670"];

function initials(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return ((parts[0][0] || "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export default function Avatar({ url, name, size = 32, className = "" }) {
  const style = { width: size, height: size };
  if (url) {
    return <img src={url} alt="" width={size} height={size} loading="lazy" className={`rounded-full object-cover flex-shrink-0 ${className}`} style={style} />;
  }
  let h = 0;
  for (const ch of String(name || "")) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const i = h % TINTS.length;
  return (
    <span
      aria-hidden="true"
      className={`rounded-full flex-shrink-0 inline-flex items-center justify-center font-semibold ${className}`}
      style={{ ...style, background: TINTS[i], color: INKS[i], fontSize: Math.max(10, Math.round(size * 0.38)) }}
    >
      {initials(name)}
    </span>
  );
}
