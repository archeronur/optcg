'use client'

import { useEffect } from 'react'

type ErrorProps = {
  error: Error & { digest?: string }
  reset: () => void
}

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div style={{ padding: 24 }}>
      <h2>Bir hata oluştu.</h2>
      <pre style={{ whiteSpace: 'pre-wrap' }}>{error?.message}</pre>
      <button onClick={() => reset()}>Tekrar dene</button>
    </div>
  )
}
