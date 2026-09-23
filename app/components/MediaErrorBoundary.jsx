"use client";

import { Component } from "react";

// Wraps NativeDocViewer/NativeAudioPlayer specifically because they're
// the riskiest pieces of the viewer -- third-party canvas rendering
// (PDF.js) and raw <audio> element handling, both with real async
// lifecycles that toggling Lyrics on/off can interrupt mid-flight.
// Without this, any uncaught error in either one crashed the entire
// view (Next's generic "reload the page" screen) instead of just that
// one section. A functional component can't catch render errors --
// error boundaries are one of the few things that still require a
// class component in React.
export default class MediaErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("MediaErrorBoundary caught an error:", error, info);
  }

  componentDidUpdate(prevProps) {
    // Recovers automatically once whatever caused the error is gone
    // (e.g. the field it was showing got toggled off) rather than
    // staying stuck on the fallback message until the whole viewer is
    // closed and reopened.
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-full flex items-center justify-center px-4 text-center">
          <p className="text-sm text-inkfaint">Something went wrong showing this. Try a different link above.</p>
        </div>
      );
    }
    return this.props.children;
  }
}
