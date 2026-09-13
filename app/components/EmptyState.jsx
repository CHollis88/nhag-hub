"use client";

export default function EmptyState({ icon: Icon, text }) {
  return (
    <div className="flex flex-col items-center text-center py-16 text-inkfaint">
      <Icon size={28} strokeWidth={1.5} className="opacity-60 mb-2.5" />
      <p className="text-sm">{text}</p>
    </div>
  );
}
