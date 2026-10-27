import Link from 'next/link'
import styles from './StatusPage.module.css'

type Props = {
  code: string
  title: string
  text: string
  children?: React.ReactNode
  /** Zonder websiteheader (404 buiten de websitelay-out): logo tonen. */
  standalone?: boolean
}

/** Gedeelde opmaak voor “niet gevonden” en foutmeldingen. */
export function StatusPage({ code, title, text, children, standalone }: Props) {
  return (
    <section className={`container ${styles.page} ${standalone ? styles.standalone : ''}`} aria-labelledby="status-titel">
      {standalone ? (
        <Link href="/" className={styles.logo} aria-label="Goed Geregeld Autoverhuur, naar de homepage">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-260.png" width={260} height={94} alt="Goed Geregeld Autoverhuur" />
        </Link>
      ) : null}
      <p className={styles.code}>{code}</p>
      <h1 id="status-titel" className={`t-h1 ${styles.title}`}>
        {title}
      </h1>
      <p className={`t-lead ${styles.text}`}>{text}</p>
      <div className={styles.actions}>{children}</div>
    </section>
  )
}
