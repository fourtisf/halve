'use client'
import { useToast } from '@/lib/toast'

export function Toast() {
  const { message, show } = useToast()
  return <div className={'toast' + (show ? ' show' : '')} id="toast" role="status" aria-live="polite">{message}</div>
}
