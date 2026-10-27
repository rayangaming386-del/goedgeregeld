'use client'

/** Onverwachte fout in het beheer. De melding bevat geen technische details. */
export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="adm-empty" style={{ margin: '4rem auto', maxWidth: '36rem' }}>
      <h1 className="adm-title">Er ging iets mis</h1>
      <p>De pagina kon niet worden geladen of de laatste actie is niet afgerond. Probeer het opnieuw en controleer daarna of je wijziging is opgeslagen. Blijft dit gebeuren, noteer dan deze code voor de beheerder.</p>
      {error.digest ? <p className="adm-small adm-mono">Code: {error.digest}</p> : null}
      <p style={{ marginTop: '1.25rem' }}>
        <button type="button" className="btn btn--primary btn--sm" onClick={() => reset()}>
          Opnieuw proberen
        </button>
      </p>
    </div>
  )
}
