"use client";

import ToastProvider from "./ToastProvider";
import { ConfirmProvider } from "./ConfirmDialog";
import { PinProvider } from "./PinPrompt";
import PlayerProvider from "./PlayerProvider";
import ReadAloudBar from "./ReadAloudBar";

// Mounted once in app/layout.js so every screen can use useToast() and
// useConfirm() (v71 #39, #40).
export default function UiProviders({ children }) {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <PinProvider>
          <PlayerProvider>{children}<ReadAloudBar /></PlayerProvider>
        </PinProvider>
      </ConfirmProvider>
    </ToastProvider>
  );
}
