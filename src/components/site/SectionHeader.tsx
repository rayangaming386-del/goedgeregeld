import styles from './SectionHeader.module.css'

type Props = {
  id?: string
  eyebrow: string
  title: string
  intro?: string | null
  level?: 'h1' | 'h2'
  align?: 'split' | 'stack'
  children?: React.ReactNode
}

/** Sectiekop: label, titel (regel-reveal) en optionele intro. */
export function SectionHeader({ id, eyebrow, title, intro, level = 'h2', align = 'split', children }: Props) {
  const Heading = level
  return (
    <div className={`${styles.header} ${align === 'split' ? styles.split : styles.stack}`}>
      <div className={styles.titleCol}>
        <p className="t-label eyebrow" data-reveal="up">
          {eyebrow}
        </p>
        <Heading id={id} className={level === 'h1' ? 't-h1' : 't-h2'} data-reveal="lines">
          {title}
        </Heading>
      </div>
      {intro || children ? (
        <div className={styles.introCol} data-reveal="up">
          {intro ? <p className="t-lead">{intro}</p> : null}
          {children}
        </div>
      ) : null}
    </div>
  )
}
