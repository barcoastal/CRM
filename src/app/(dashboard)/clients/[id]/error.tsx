"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function ClientDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Client detail page error:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 p-8">
      <h2 className="text-xl font-semibold text-destructive">
        Error Loading Client
      </h2>
      <div className="max-w-lg text-center space-y-2">
        <p className="text-muted-foreground">
          {error.message || "An unexpected error occurred"}
        </p>
        {error.digest && (
          <p className="text-xs text-muted-foreground">
            Digest: {error.digest}
          </p>
        )}
        <pre className="mt-4 p-4 bg-muted rounded-md text-xs text-left overflow-auto max-h-64 whitespace-pre-wrap">
          {error.stack || String(error)}
        </pre>
      </div>
      <Button onClick={reset}>Try Again</Button>
    </div>
  );
}
