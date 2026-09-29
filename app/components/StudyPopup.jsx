"use client";

import Modal from "./Modal";

// The compact popup card used by the Bible reader (word study, verse
// popups, translation/font pickers...). Now a thin wrapper over the shared
// Modal so it gets the same dialog behavior everywhere: labelled title,
// Escape to close, focus trap + restore, scroll lock, safe-area padding.
export default function StudyPopup({ title, onClose, children }) {
  return (
    <Modal
      title={title}
      onClose={onClose}
      width="popup"
      maxHeight="70vh"
      z={50}
      padding="p-5"
      headingClassName="font-serif text-lg text-ink m-0 min-w-0"
    >
      {children}
    </Modal>
  );
}
