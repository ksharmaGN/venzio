import Link from 'next/link'
import MarketingNav from '@/components/marketing/MarketingNav'
import MarketingFooter from '@/components/marketing/MarketingFooter'
import { en } from '@/locales/en'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Download Venzio for Android',
  description:
    'Install the Venzio Android app for reliable office arrival and checkout reminders without the Play Store.',
  alternates: { canonical: '/download' },
  openGraph: {
    title: 'Download Venzio for Android',
    description: 'Sideload the Venzio Android APK for native check-in and local reminders.',
    url: '/download',
  },
}

const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? `https://${en.brand.domain}`
const apkUrl = `${siteUrl}/downloads/venzio-latest.apk`

export default function DownloadPage() {
  return (
    <>
      <MarketingNav />
      <main style={{ maxWidth: '720px', margin: '0 auto', padding: '80px 24px' }}>
        <p
          style={{
            fontSize: '12px',
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--brand)',
            fontFamily: 'Plus Jakarta Sans, sans-serif',
          }}
        >
          {en.download.label}
        </p>
        <h1
          style={{
            fontFamily: 'Playfair Display, serif',
            fontSize: 'clamp(28px, 4vw, 40px)',
            color: 'var(--navy)',
            margin: '12px 0',
          }}
        >
          {en.download.title}
        </h1>
        <p style={{ fontSize: '15px', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
          {en.download.intro}
        </p>

        <div
          style={{
            marginTop: '32px',
            padding: '24px',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            background: 'var(--surface-0)',
          }}
        >
          <a
            href={apkUrl}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              height: '48px',
              padding: '0 24px',
              background: 'var(--brand)',
              color: '#fff',
              borderRadius: 'var(--radius-md)',
              fontWeight: 600,
              textDecoration: 'none',
              fontFamily: 'Plus Jakarta Sans, sans-serif',
            }}
          >
            {en.download.downloadApk}
          </a>
          <p style={{ marginTop: '16px', fontSize: '13px', color: 'var(--text-muted)' }}>
            {en.download.iosNote}
          </p>
        </div>

        <ol
          style={{
            marginTop: '32px',
            paddingLeft: '20px',
            fontSize: '14px',
            color: 'var(--text-secondary)',
            lineHeight: 1.8,
          }}
        >
          {en.download.steps.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>

        <p style={{ marginTop: '24px', fontSize: '13px', color: 'var(--text-muted)' }}>
          {en.download.checksumNote}
        </p>

        <p style={{ marginTop: '16px' }}>
          <Link href="/for-you" style={{ color: 'var(--brand)', fontSize: '14px' }}>
            {en.download.pwaLink}
          </Link>
        </p>
      </main>
      <MarketingFooter />
    </>
  )
}
