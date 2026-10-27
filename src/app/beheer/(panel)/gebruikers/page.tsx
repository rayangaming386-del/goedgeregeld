import type { Metadata } from 'next'
import { AdminLink as Link } from '@/components/admin/AdminLink'
import { ActionForm, FieldError, FormMessage, SecretNotice, SubmitButton } from '@/components/admin/ActionForm'
import { ConfirmSubmit } from '@/components/admin/ConfirmSubmit'
import { NoAccess, PageHeader } from '@/components/admin/PageHeader'
import { Alert, Check, Lock } from '@/components/icons'
import { can, PERMISSION_LABELS, PERMISSIONS, ROLE_DESCRIPTIONS, ROLE_LABELS, ROLES } from '@/domain/permissions'
import { formatDateTimeShort } from '@/domain/time'
import { requireUser } from '@/server/auth/session'
import { getDb } from '@/server/db/client'
import { listUsers } from '@/server/users/service'
import { inviteUserAction, userCommandAction } from './actions'

export const metadata: Metadata = { title: 'Gebruikers' }

export default async function UsersPage() {
  const me = await requireUser()
  if (!can(me.role, 'gebruikers:beheren')) return <NoAccess />
  const list = await listUsers(getDb())

  return (
    <>
      <PageHeader title="Gebruikers" description="Wie toegang heeft tot het beheer en met welke rol. Rechten worden op de server gecontroleerd, niet alleen in de interface." />
      <div className="adm-grid adm-grid--split">
        <section className="adm-panel" aria-labelledby="accounts">
          <h2 id="accounts" className="adm-section-title">
            Accounts
          </h2>
          <ul className="adm-list adm-users">
            {list.map((u) => {
              const self = u.id === me.id
              return (
                <li key={u.id} className={u.active ? '' : 'is-inactive'}>
                  <div className="adm-users__head">
                    <div>
                      <strong>{u.name}</strong>
                      {self ? <span className="adm-small"> (jij)</span> : null}
                      <p className="adm-small adm-break">{u.email}</p>
                    </div>
                    <span className="adm-chips">
                      <span className="chip">{ROLE_LABELS[u.role]}</span>
                      {u.active ? (
                        <span className="adm-badge tone-ok">
                          <Check size={12} /> Actief
                        </span>
                      ) : (
                        <span className="adm-badge tone-muted">
                          <Lock size={12} /> Gedeactiveerd
                        </span>
                      )}
                      {u.mustChangePassword && u.active ? (
                        <span className="adm-badge tone-warn">
                          <Alert size={12} /> Tijdelijk wachtwoord
                        </span>
                      ) : null}
                    </span>
                  </div>
                  <p className="adm-small">
                    {u.lastLoginAt ? `Laatst ingelogd ${formatDateTimeShort(u.lastLoginAt)}` : 'Nog niet ingelogd'} · aangemaakt{' '}
                    {formatDateTimeShort(u.createdAt)}
                  </p>
                  {self ? (
                    <p className="adm-small">
                      Je eigen rol en status kan alleen een andere eigenaar wijzigen. Je wachtwoord wijzig je via{' '}
                      <Link href="/beheer/account">Mijn account</Link>.
                    </p>
                  ) : (
                    <details className="adm-users__manage">
                      <summary className="btn btn--ghost btn--sm">Beheren</summary>
                      <div className="adm-grid">
                        <ActionForm action={userCommandAction} className="adm-row-form" aria-label={`Rol van ${u.name}`}>
                          <input type="hidden" name="userId" value={u.id} />
                          <input type="hidden" name="command" value="rol" />
                          <div className="field">
                            <label className="field__label" htmlFor={`rol-${u.id}`}>
                              Rol
                            </label>
                            <select className="select" id={`rol-${u.id}`} name="role" defaultValue={u.role}>
                              {ROLES.map((r) => (
                                <option key={r} value={r}>
                                  {ROLE_LABELS[r]}
                                </option>
                              ))}
                            </select>
                          </div>
                          <SubmitButton variant="secondary">Rol opslaan</SubmitButton>
                          <FormMessage />
                        </ActionForm>
                        <ActionForm action={userCommandAction} className="adm-row-form" aria-label={`Naam van ${u.name}`}>
                          <input type="hidden" name="userId" value={u.id} />
                          <input type="hidden" name="command" value="naam" />
                          <div className="field">
                            <label className="field__label" htmlFor={`naam-${u.id}`}>
                              Naam
                            </label>
                            <input className="input" id={`naam-${u.id}`} name="name" defaultValue={u.name} maxLength={80} />
                          </div>
                          <SubmitButton variant="secondary">Naam opslaan</SubmitButton>
                          <FormMessage />
                        </ActionForm>
                        <ActionForm action={userCommandAction} className="adm-chips" aria-label={`Toegang van ${u.name}`}>
                          <input type="hidden" name="userId" value={u.id} />
                          {u.active ? (
                            <>
                              <ConfirmSubmit
                                label="Nieuw tijdelijk wachtwoord"
                                title={`Nieuw wachtwoord voor ${u.name}?`}
                                description="Het huidige wachtwoord werkt dan niet meer en alle sessies van dit account worden beëindigd. Je ziet het tijdelijke wachtwoord één keer."
                                confirmLabel="Wachtwoord vervangen"
                                name="command"
                                value="wachtwoord"
                                variant="secondary"
                              />
                              <ConfirmSubmit
                                label="Deactiveren"
                                title={`${u.name} deactiveren?`}
                                description="Het account kan niet meer inloggen en wordt direct overal uitgelogd. De geschiedenis blijft bewaard."
                                confirmLabel="Deactiveren"
                                name="command"
                                value="deactiveren"
                              />
                            </>
                          ) : (
                            <SubmitButton name="command" value="activeren" variant="secondary">
                              Weer toegang geven
                            </SubmitButton>
                          )}
                          <FormMessage />
                          <SecretNotice />
                        </ActionForm>
                      </div>
                    </details>
                  )}
                </li>
              )
            })}
          </ul>
        </section>

        <div className="adm-grid">
          <section className="adm-panel" aria-labelledby="toevoegen">
            <h2 id="toevoegen" className="adm-section-title">
              Account toevoegen
            </h2>
            <ActionForm action={inviteUserAction} className="adm-form" aria-label="Account toevoegen">
              <div className="field">
                <label className="field__label" htmlFor="nieuw-naam">
                  Naam
                </label>
                <input className="input" id="nieuw-naam" name="name" autoComplete="off" maxLength={80} />
                <FieldError name="name" />
              </div>
              <div className="field">
                <label className="field__label" htmlFor="nieuw-email">
                  E-mailadres
                </label>
                <input className="input" id="nieuw-email" name="email" type="email" autoComplete="off" maxLength={160} />
                <FieldError name="email" />
              </div>
              <div className="field">
                <label className="field__label" htmlFor="nieuw-rol">
                  Rol
                </label>
                <select className="select" id="nieuw-rol" name="role" defaultValue="medewerker">
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
                <FieldError name="role" />
              </div>
              <FormMessage />
              <SecretNotice />
              <div className="adm-form-actions">
                <SubmitButton>Account aanmaken</SubmitButton>
              </div>
            </ActionForm>
          </section>

          <section className="adm-panel" aria-labelledby="rollen">
            <h2 id="rollen" className="adm-section-title">
              Rollen
            </h2>
            <dl className="adm-dl adm-dl--stacked">
              {ROLES.map((r) => (
                <div key={r}>
                  <dt>{ROLE_LABELS[r]}</dt>
                  <dd>{ROLE_DESCRIPTIONS[r]}</dd>
                </div>
              ))}
            </dl>
            <details>
              <summary className="btn btn--ghost btn--sm">Alle rechten per rol</summary>
              <div className="adm-table-wrap">
                <table className="adm-table adm-rights">
                  <caption className="visually-hidden">Rechten per rol</caption>
                  <thead>
                    <tr>
                      <th scope="col">Recht</th>
                      {ROLES.map((r) => (
                        <th key={r} scope="col">
                          {ROLE_LABELS[r]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {PERMISSIONS.map((p) => (
                      <tr key={p}>
                        <th scope="row">{PERMISSION_LABELS[p]}</th>
                        {ROLES.map((r) => (
                          <td key={r}>
                            {can(r, p) ? (
                              <>
                                <Check size={14} />
                                <span className="visually-hidden">ja</span>
                              </>
                            ) : (
                              <span aria-label="nee">–</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </section>
        </div>
      </div>
    </>
  )
}
