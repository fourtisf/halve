import { ImageResponse } from 'next/og'

export const alt = 'Halve — Fixed yield and dividend tokens for tokenized stocks'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', background: '#000', color: '#FAFAFA', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 72, fontFamily: 'Inter, system-ui, sans-serif' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 32, fontWeight: 600 }}>
          <div style={{ width: 40, height: 40, borderRadius: 999, background: 'linear-gradient(90deg, #fff 50%, #E8C170 50%)' }} />
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
