"use client";

// The Reply controls for a post that allows replies, styled like the
// "+ React" chip so the two sit side by side in one row:
//
//   [ + React ]  [ Reply ]              (thread closed)
//   [ + React ]  [ Reply ]  [ Hide replies ]   (thread open)
//
// "Reply" opens the thread with the reply box focused (or, if it's already
// open, just puts the cursor back in the box). "Hide replies" only appears
// while the thread is open and closes it.
const chip = "text-[0.6875rem] leading-none rounded-full px-1.5 py-1 border border-line text-inkfaint bg-card";

export default function ReplyButtons({ open, onOpen, onHide, inputId, label = "Reply" }) {
  return (
    <>
      <button
        type="button"
        onClick={() => (open ? document.getElementById(inputId)?.focus() : onOpen())}
        aria-expanded={open}
        className={chip}
      >
        {label}
      </button>
      {open && (
        <button type="button" onClick={onHide} className={chip}>
          Hide replies
        </button>
      )}
    </>
  );
}
