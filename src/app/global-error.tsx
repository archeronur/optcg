'use client'

type GlobalErrorProps = {
  error: Error & { digest?: string }
  reset: () => void
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  return (
    <html lang="tr">
      <body>
        <h2 style={{ textAlign: 'center', marginTop: 40 }}>Bir şeyler ters gitti.</h2>
        <pre style={{ whiteSpace: 'pre-wrap', padding: 16 }}>{error?.message}</pre>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button onClick={() => reset()}>Tekrar dene</button>
          <button onClick={() => location.reload()}>Yenile</button>
        </div>
      </body>
    </html>
  )
}
