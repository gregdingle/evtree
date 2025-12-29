"use client";

import { CanvasCenteredHelpMessage } from "./components/CanvasCenteredHelpMessage";

/**
 * see https://nextjs.org/docs/app/api-reference/file-conventions/error#global-error
 */
export default function GlobalError(
  {
    // error,
    // reset,
  }: {
    error: Error & { digest?: string };
    reset: () => void;
  },
) {
  // TODO: something fancier
  // TODO: make sure errors are being logged somewhere... vercel?
  return (
    <html>
      <body>
        <CanvasCenteredHelpMessage text="Something went wrong!" />
      </body>
    </html>
  );
}
