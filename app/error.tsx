// app/error.tsx
'use client';

import { addNextjsError } from '@datadog/browser-rum-nextjs';
import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    addNextjsError(error);
  }, [error]);

  return <button onClick={reset}>Try again</button>;
}
