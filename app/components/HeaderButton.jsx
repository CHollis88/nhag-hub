"use client";

// One of the buttons in the app's top bar. Normally an icon on its own (compact,
// as it has always been). In Simple mode (v71) it is the icon WITH A WORD under
// it, on a bigger target -- so nobody has to guess what a bell or a cog does.
// The accessible name, tooltip and behaviour are the same in both.
//
//   <HeaderButton simple={simple} label="Alerts" ariaLabel="Notifications" icon={Bell} onClick={...}
//                 badge={<span .../>} />
export default function HeaderButton({ simple, label, ariaLabel, title, icon: Icon, onClick, badge, iconSize = 22 }) {
  if (simple) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel || label}
        title={title || label}
        className="relative flex flex-col items-center justify-center gap-0.5 min-w-[52px] min-h-[44px] px-1 text-white"
      >
        <span className="relative">
          <Icon size={22} aria-hidden="true" />
          {badge}
        </span>
        <span className="text-[0.6875rem] font-medium leading-none">{label}</span>
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel || label}
      title={title || label}
      className="relative text-white/90 p-1"
    >
      <Icon size={iconSize} aria-hidden="true" />
      {badge}
    </button>
  );
}
