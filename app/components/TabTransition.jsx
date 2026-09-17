// Wraps tab content so that switching tabs (or any other `tabKey` change)
// triggers a short fade-in instead of content abruptly replacing content.
// Passing a new `tabKey` remounts the div (React's own key-change
// behavior), which re-triggers the CSS animation defined in globals.css.
//
// h-full matters here, not just cosmetic: it's what lets a tab like
// Messages or Chat build its own internal "scrollable message list +
// pinned compose bar" flex layout (h-full flex flex-col) and actually
// have it work. Without an explicit height here, this div's own height
// is auto/content-based, which breaks the percentage-height chain those
// tabs rely on -- their h-full then resolves to nothing, so the whole
// tab (compose bar included) grows past the viewport and scrolls away
// with the page instead of only its message list scrolling internally.
// Harmless for simple page-like tabs (News, Events, etc.) since they
// already rely on the page scrolling as a whole.
export default function TabTransition({ tabKey, children }) {
  return (
    <div key={tabKey} className="tab-fade-in h-full min-h-0 flex flex-col">
      {children}
    </div>
  );
}
