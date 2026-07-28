'use client'

import { useParams } from 'next/navigation'
import { OpeningBalancesSection } from './OpeningBalancesSection'
import { LeaveTypesSection } from './LeaveTypesSection'
import { LeaveRequestsSection } from './LeaveRequestsSection'

export default function AdminLeavesPage() {
  const { slug } = useParams<{ slug: string }>()

  return (
    <div className="leaves-page">
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: '22px', fontWeight: 700, color: 'var(--navy)', margin: '0 0 4px' }}>
          Leaves
        </h1>
        <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
          Configure leave types and review all member leave requests.
        </p>
      </div>

      <LeaveTypesSection slug={slug} />
      <OpeningBalancesSection slug={slug} />
      <LeaveRequestsSection slug={slug} />

      <style>{`
        @keyframes vnz-pulse{0%,100%{opacity:1}50%{opacity:.5}}
        .leaves-page{
          width:100%;
          max-width:900px;
          margin:0 auto;
          padding:20px 16px;
          box-sizing:border-box;
        }
        @media(min-width:640px){
          .leaves-page{padding:28px 32px;}
        }
      `}</style>
    </div>
  )
}
