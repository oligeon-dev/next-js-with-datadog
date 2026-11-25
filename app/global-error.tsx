// app/global-error.tsx
'use client';

import { addNextjsError } from '@datadog/browser-rum-nextjs';
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    addNextjsError(error);
  }, [error]);

  return (
    <html>
      <body>
        <button onClick={reset}>Try again</button>
      </body>
    </html>
  );
}
