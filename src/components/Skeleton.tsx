/** Inline shimmer placeholder for a number that is still loading. */
export function Skel({ w = 56 }: { w?: number }) {
  return <span className="skel" style={{ width: w }} aria-hidden="true" />
}

export function Banner({ kind, children }: { kind?: 'r' | 'y'; children: React.ReactNode }) {
  return <div className={'banner' + (kind ? ' ' + kind : '')} role="status">{children}</div>
}

export const RPC_ERROR_TEXT = "Couldn't reach Robinhood Chain RPC · retrying every 12 s"
