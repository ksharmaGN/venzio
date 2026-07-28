import { notFound } from 'next/navigation'
import { FileText } from 'lucide-react'
import { getWorkspaceBySlug } from '@/lib/db/queries/workspaces'

interface Props { params: Promise<{ slug: string }> }

export default async function ReportsPage({ params }: Props) {
  const { slug } = await params
  const workspace = await getWorkspaceBySlug(slug)
  if (!workspace) notFound()

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '24px 20px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{
          fontFamily: 'Playfair Display, serif', fontSize: '22px', fontWeight: 700,
          color: 'var(--navy)', margin: '0 0 6px',
        }}>
          Reports
        </h1>
        <p style={{
          fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '14px',
          color: 'var(--text-secondary)', margin: 0,
        }}>
          Scheduled and exportable attendance reports for your workspace.
        </p>
      </div>

      <div style={{
        background: 'var(--surface-0)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)', padding: '48px 24px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '12px',
      }}>
        <div style={{
          width: '48px', height: '48px', borderRadius: 'var(--radius-md)',
          background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <FileText size={22} color="var(--text-secondary)" />
        </div>
        <h2 style={{
          fontFamily: 'Playfair Display, serif', fontSize: '17px', fontWeight: 600,
          color: 'var(--navy)', margin: 0,
        }}>
          Reports are coming soon
        </h2>
        <p style={{
          fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '13px',
          color: 'var(--text-secondary)', margin: 0, maxWidth: '420px', lineHeight: 1.5,
        }}>
          We&apos;re building scheduled and exportable attendance reports. Check back soon.
        </p>
      </div>
    </div>
  )
}
