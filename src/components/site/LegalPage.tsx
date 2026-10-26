import { formatDate } from '@/domain/time'
import type { PublicPage } from '@/server/public/queries'
import styles from './LegalPage.module.css'

/** Eenvoudige opmaak: ‘## ’ wordt een kop, ‘- ’ een lijst, lege regels scheiden alinea’s. */
function renderBody(body: string) {
  const blocks = body.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean)
  return blocks.map((block, i) => {
    if (block.startsWith('## ')) return <h2 key={i}>{block.slice(3)}</h2>
    const lines = block.split('\n')
    if (lines.every((l) => l.startsWith('- '))) {
      return (
        <ul key={i}>
          {lines.map((l, j) => (
            <li key={j}>{l.slice(2)}</li>
          ))}
        </ul>
      )
    }
    if (lines[0]?.startsWith('## ')) {
      return (
        <div key={i}>
          <h2>{lines[0].slice(3)}</h2>
          <p>{lines.slice(1).join(' ')}</p>
        </div>
      )
    }
    return <p key={i}>{lines.join(' ')}</p>
  })
}

export function LegalPage({ page }: { page: PublicPage }) {
  return (
    <article className={styles.page}>
      <div className={`container ${styles.inner}`}>
        <p className="t-label eyebrow">Goed Geregeld Autoverhuur</p>
        <h1 className="t-h1">{page.title}</h1>
        <p className={styles.updated}>Laatst bijgewerkt: {formatDate(page.updatedAt)}</p>
        <div className={styles.body}>{renderBody(page.body)}</div>
      </div>
    </article>
  )
}
