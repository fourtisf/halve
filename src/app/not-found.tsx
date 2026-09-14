import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="wrap err">
      <div>
        <div className="eyebrow" style={{ marginBottom: 20 }}>404</div>
        <h1>Nothing to split here.</h1>
        <p>That page does not exist. The series you want is probably in the app.</p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}><Link className="btn btn-white btn-lg" href="/app">Launch app</Link><Link className="btn btn-line btn-lg" href="/">Home</Link></div>
      </div>
    </div>
  )
}
