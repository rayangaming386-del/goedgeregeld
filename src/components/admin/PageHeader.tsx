export function PageHeader({ title, description, actions }: { title: string; description?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="adm-page-header">
      <div>
        <h1 className="adm-title">{title}</h1>
        {description ? <p className="adm-lead">{description}</p> : null}
      </div>
      {actions ? <div className="adm-page-actions">{actions}</div> : null}
    </div>
  )
}

export function NoAccess() {
  return (
    <div className="adm-empty">
      <h1 className="adm-title">Geen toegang</h1>
      <p>Je rol heeft geen rechten voor dit onderdeel. Vraag de eigenaar om toegang als je dit nodig hebt.</p>
    </div>
  )
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="adm-empty">
      <p className="adm-empty__title">{title}</p>
      {children}
    </div>
  )
}
