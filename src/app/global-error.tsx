"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="min-h-full flex items-center justify-center">
        <div className="max-w-md text-center space-y-4 p-6">
          <h1 className="text-xl font-semibold">Something went wrong</h1>
          <p className="text-sm text-gray-500">
            An unexpected error occurred. Please try reloading the app.
          </p>
          <button
            onClick={() => reset()}
            className="px-4 py-2 rounded bg-black text-white hover:bg-gray-800"
          >
            Reload app
          </button>
        </div>
      </body>
    </html>
  );
}
