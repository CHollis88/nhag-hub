// Wraps tab content so that switching tabs (or any other `tabKey` change)
// triggers a short fade-in instead of content abruptly replacing content.
// Passing a new `tabKey` remounts the div (React's own key-change
// behavior), which re-triggers the CSS animation defined in globals.css.
export default function TabTransition({ tabKey, children }) {
  return (
    <div key={tabKey} className="tab-fade-in">
      {children}
    </div>
  );
}
