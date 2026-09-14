import { ImageResponse } from 'next/og'

export const alt = 'Halve — Fixed yield and dividend tokens for tokenized stocks'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

/** The Stack mark drawn with plain boxes (Satori has no SVG rect transforms). */
function Mark({ px }: { px: number }) {
  const u = px / 64
  const bar = (x: number, y: number, color: string) => (
    <div style={{ position: 'absolute', left: x * u, top: y * u, width: 48 * u, height: 10 * u, borderRadius: 3 * u, background: color }} />
  )
  return (
    <div style={{ position: 'relative', width: px, height: px, display: 'flex' }}>
      {bar(8, 44, '#FAFAFA')}
      {bar(8, 30, '#FAFAFA')}
      {bar(14, 10, '#E8C170')}
    </div>
  )
}

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', background: '#000', color: '#FAFAFA', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 72, fontFamily: 'Inter, system-ui, sans-serif' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, fontSize: 34, fontWeight: 600, letterSpacing: -1 }}>
          <Mark px={44} />
          Halve
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ fontSize: 76, fontWeight: 500, letterSpacing: -4, lineHeight: 1.02, maxWidth: 1000 }}>Lock in a fixed yield on your stock tokens. Or buy the dividends outright.</div>
          <div style={{ fontSize: 28, color: '#A1A1A1' }}>Live on Robinhood Chain · Audited by Pashov</div>
        </div>
      </div>
    ),
    size,
  )
}
