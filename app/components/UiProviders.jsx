"use client";

import ToastProvider from "./ToastProvider";
import { ConfirmProvider } from "./ConfirmDialog";
import { PinProvider } from "./PinPrompt";

// Mounted once in app/layout.js so every screen can use useToast() and
// useConfirm() (v71 #39, #40).
export default function UiProviders({ children }) {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <PinProvider>{children}</PinProvider>
      </ConfirmProvider>
    </ToastProvider>
  );
}
