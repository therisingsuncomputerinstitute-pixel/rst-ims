"use client";

import { useEffect } from "react";

export function InstrumentationClient() {
  useEffect(() => {
    // Client-side instrumentation or monitoring initialization
    // For example, setting up error tracking or performance monitoring
    console.log("Cognitive Engine Client-Side Instrumentation Active");

    const handleError = (event: ErrorEvent) => {
      // Send error to monitoring service
      console.error("Client Error Captured:", event.error);
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      // Send rejection to monitoring service
      console.error("Unhandled Rejection Captured:", event.reason);
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener(
        "unhandledrejection",
        handleUnhandledRejection,
      );
    };
  }, []);

  return null;
}
