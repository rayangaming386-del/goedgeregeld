import { and, asc, desc, eq, inArray } from 'drizzle-orm'
import type { Metadata } from 'next'
import Link from 'next/link'
import { ActionForm, FieldError, FormMessage, SubmitButton } from '@/components/admin/ActionForm'
import { ConfirmSubmit } from '@/components/admin/ConfirmSubmit'
import { NoAccess, PageHeader } from '@/components/admin/PageHeader'
import { Alert, Check, Info } from '@/components/icons'
import { FAQ_TOPICS, hasPlaceholder, SETTING_LABELS, type SettingKey } from '@/domain/content'
import { can } from '@/domain/permissions'
import { formatDateTimeShort } from '@/domain/time'
import { requireUser } from '@/server/auth/session'
import { getSiteContent } from '@/server/content/settings'
import { getDb } from '@/server/db/client'
import { faqs, media, pages, revisions, users, vehicles } from '@/server/db/schema'
import { getStorage } from '@/server/storage'
import { faqCommandAction, restoreSettingAction, saveFaqAction, savePageAction, saveSettingAction } from './actions'
import { HeroTextEditor, MediaSelect, type MediaOption } from './editors'

export const metadata: Metadata = { title: 'Website-inhoud' }

const TABS = [
  { key: 'secties', label: 'Homepage-secties' },
  { key: 'faq', label: 'Veelgestelde vragen' },
  { key: 'paginas', label: 'Privacy en voorwaarden' },
  { key: 'versies', label: 'Eerdere versies' },
] as const

function TextField({ id, name, label, defaultValue, max, rows, hint }: { id: string; name: string; label: string; defaultValue: string; max: number; rows?: number; hint?: string }) {
  const hintId = hint ? `${id}-hint` : undefined
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label} <span className="field__optional">(max. {max})</span>
      </label>
      {rows ? (
        <textarea className="textarea" id={id} name={name} rows={rows} defaultValue={defaultValue} maxLength={max + 50} aria-describedby={hintId} />
      ) : (
        <input className="input" id={id} name={name} defaultValue={defaultValue} maxLength={max + 20} aria-describedby={hintId} />
      )}
      {hint ? (
        <p className="field__hint" id={hintId}>
          {hint}
        </p>
      ) : null}
      <FieldError name={name} />
    </div>
  )
}

function SectionForm({ settingKey, children, title }: { settingKey: SettingKey; children: React.ReactNode; title?: string }) {
  return (
    <section className="adm-panel" aria-labelledby={`sectie-${settingKey}`}>
      <h2 id={`sectie-${settingKey}`} className="adm-section-title">
        {title ?? SETTING_LABELS[settingKey]}
      </h2>
      <ActionForm action={saveSettingAction} className="adm-form" aria-label={SETTING_LABELS[settingKey]}>
        <input type="hidden" name="key" value={settingKey} />
        {children}
        <FormMessage />
        <div className="adm-form-actions">
          <SubmitButton>Opslaan</SubmitButton>
        </div>
      </ActionForm>
    </section>
  )
}

export default async function ContentPage({ searchParams }: PageProps<'/beheer/inhoud'>) {
  const user = await requireUser()
  if (!can(user.role, 'inhoud:beheren')) return <NoAccess />
  const sp = await searchParams
  const tab = TABS.find((t) => t.key === sp.tab)?.key ?? 'secties'
  const db = getDb()
  const content = await getSiteContent()
  const storage = getStorage()

  const mediaRows = await db
    .select({ id: media.id, alt: media.alt, variants: media.variants, vehicle: vehicles.name, sortOrder: media.sortOrder })
    .from(media)
    .innerJoin(vehicles, eq(vehicles.id, media.vehicleId))
    .where(eq(media.isPublic, true))
    .orderBy(asc(vehicles.sortOrder), asc(media.sortOrder))
  const mediaOptions: MediaOption[] = mediaRows.map((m, i) => {
    const small = m.variants.filter((x) => x.format === 'webp').sort((a, b) => a.width - b.width)[0]
    return { id: m.id, group: m.vehicle, label: `${m.alt.slice(0, 70) || `Foto ${i + 1}`}`, src: small ? storage.publicUrl(small.key) : '' }
  })
  const vehicleNames = new Map((await db.select({ id: vehicles.id, name: vehicles.name }).from(vehicles)).map((v) => [v.id, v.name]))
  const canContact = can(user.role, 'instellingen:beheren')
  const canApprove = can(user.role, 'paginas:goedkeuren')

  return (
    <>
      <PageHeader
        title="Website-inhoud"
        description="Teksten en beelden van de website. Wijzigingen zijn direct zichtbaar; elke vorige versie wordt bewaard en kan worden hersteld."
        actions={
          <Link href="/" className="btn btn--ghost btn--sm" target="_blank" rel="noopener">
            Website bekijken
          </Link>
        }
      />
      <nav className="adm-tabs" aria-label="Onderdelen">
        {TABS.map((t) => (
          <Link key={t.key} href={`/beheer/inhoud?tab=${t.key}`} aria-current={tab === t.key ? 'page' : undefined}>
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === 'secties' ? (
        <div className="adm-grid">
          <SectionForm settingKey="hero">
            <div className="adm-form-grid">
              <TextField id="hero-eyebrow" name="eyebrow" label="Label boven de kop" defaultValue={content.hero.eyebrow} max={48} />
              <TextField id="hero-model" name="modelLabel" label="Bijschrift foto" defaultValue={content.hero.modelLabel} max={40} />
            </div>
            <HeroTextEditor headline={content.hero.headline} accent={content.hero.headlineAccent} intro={content.hero.intro} />
            <div className="adm-form-grid">
              <TextField id="hero-cta1" name="primaryCta" label="Knop 1 (wagenpark)" defaultValue={content.hero.primaryCta} max={32} />
              <TextField id="hero-cta2" name="secondaryCta" label="Knop 2 (aanvragen)" defaultValue={content.hero.secondaryCta} max={32} />
            </div>
            <MediaSelect name="mediaId" label="Foto" options={mediaOptions} defaultValue={content.hero.mediaId} focalX={content.hero.focalX} focalY={content.hero.focalY} idPrefix="hero" aspect="3 / 4" />
          </SectionForm>

          <SectionForm settingKey="marquee">
            <div className="field">
              <label className="field__label" htmlFor="marquee-items">
                Teksten (één per regel, 2 tot 8, max. 32 tekens)
              </label>
              <textarea className="textarea" id="marquee-items" name="items" rows={5} defaultValue={content.marquee.items.join('\n')} aria-describedby="marquee-hint" />
              <p className="field__hint" id="marquee-hint">
                Gebruik alleen uitspraken die kloppen. De tekstbalk staat stil bij “verminderde beweging”.
              </p>
              <FieldError name="items" />
            </div>
          </SectionForm>

          <SectionForm settingKey="fleetIntro">
            <div className="adm-form-grid">
              <TextField id="fleet-eyebrow" name="eyebrow" label="Label" defaultValue={content.fleetIntro.eyebrow} max={40} />
              <TextField id="fleet-title" name="title" label="Titel" defaultValue={content.fleetIntro.title} max={70} />
            </div>
            <TextField id="fleet-intro" name="intro" label="Introductie" defaultValue={content.fleetIntro.intro} max={260} rows={3} />
          </SectionForm>

          <SectionForm settingKey="signature">
            <div className="adm-form-grid">
              <TextField id="sig-eyebrow" name="eyebrow" label="Label" defaultValue={content.signature.eyebrow} max={40} />
              <TextField id="sig-title" name="title" label="Titel" defaultValue={content.signature.title} max={60} />
            </div>
            <TextField id="sig-intro" name="intro" label="Introductie" defaultValue={content.signature.intro} max={220} rows={2} />
            {content.signature.chapters.map((c, i) => (
              <fieldset key={c.vehicleId} className="adm-fieldset">
                <legend>
                  Hoofdstuk {i + 1}: {vehicleNames.get(c.vehicleId) ?? 'onbekende auto'}
                </legend>
                <TextField id={`line-${i}`} name={`line-${i}`} label="Regel onder de naam" defaultValue={c.line} max={120} />
                <MediaSelect name={`media-${i}`} label="Groot beeld" options={mediaOptions} defaultValue={c.mediaId} idPrefix={`sig-${i}`} />
                <MediaSelect name={`detail-${i}`} label="Detailbeeld" options={mediaOptions} defaultValue={c.detailMediaId} idPrefix={`sigd-${i}`} aspect="1 / 1" />
              </fieldset>
            ))}
          </SectionForm>

          <SectionForm settingKey="process">
            <div className="adm-form-grid">
              <TextField id="proc-eyebrow" name="eyebrow" label="Label" defaultValue={content.process.eyebrow} max={40} />
              <TextField id="proc-title" name="title" label="Titel" defaultValue={content.process.title} max={60} />
            </div>
            {[0, 1, 2, 3].map((i) => (
              <fieldset className="adm-fieldset adm-step" key={i}>
                <legend>Stap {i + 1}</legend>
                <TextField id={`st-${i}`} name={`step-title-${i}`} label="Titel" defaultValue={content.process.steps[i]?.title ?? ''} max={48} />
                <TextField id={`sb-${i}`} name={`step-body-${i}`} label="Tekst" defaultValue={content.process.steps[i]?.body ?? ''} max={220} rows={2} />
              </fieldset>
            ))}
            <FieldError name="steps" />
            <TextField id="proc-note" name="note" label="Opmerking onder de stappen" defaultValue={content.process.note} max={200} rows={2} />
          </SectionForm>

          <SectionForm settingKey="about">
            <div className="adm-form-grid">
              <TextField id="about-eyebrow" name="eyebrow" label="Label" defaultValue={content.about.eyebrow} max={40} />
              <TextField id="about-title" name="title" label="Titel" defaultValue={content.about.title} max={80} />
            </div>
            <TextField
              id="about-body"
              name="body"
              label="Tekst"
              defaultValue={content.about.body}
              max={900}
              rows={7}
              hint="Geen verzonnen geschiedenis, aantallen klanten of jaren ervaring. Een lege regel begint een nieuwe alinea."
            />
            <MediaSelect name="mediaId" label="Foto" options={mediaOptions} defaultValue={content.about.mediaId} focalX={content.about.focalX} focalY={content.about.focalY} idPrefix="about" />
          </SectionForm>

          <SectionForm settingKey="faqIntro">
            <div className="adm-form-grid">
              <TextField id="faq-eyebrow" name="eyebrow" label="Label" defaultValue={content.faqIntro.eyebrow} max={40} />
              <TextField id="faq-title" name="title" label="Titel" defaultValue={content.faqIntro.title} max={60} />
            </div>
            <TextField id="faq-outro" name="outro" label="Afsluitende zin" defaultValue={content.faqIntro.outro} max={200} rows={2} />
          </SectionForm>

          <SectionForm settingKey="closing">
            <div className="adm-form-grid">
              <TextField id="cl-eyebrow" name="eyebrow" label="Label" defaultValue={content.closing.eyebrow} max={40} />
              <TextField id="cl-title" name="title" label="Titel" defaultValue={content.closing.title} max={70} />
            </div>
            <TextField id="cl-body" name="body" label="Tekst" defaultValue={content.closing.body} max={260} rows={3} />
            <div className="adm-form-grid">
              <TextField id="cl-cta1" name="primaryCta" label="Knop (aanvragen)" defaultValue={content.closing.primaryCta} max={32} />
              <TextField id="cl-cta2" name="whatsappCta" label="Knop (WhatsApp)" defaultValue={content.closing.whatsappCta} max={32} />
            </div>
            <MediaSelect name="mediaId" label="Foto" options={mediaOptions} defaultValue={content.closing.mediaId} focalX={content.closing.focalX} focalY={content.closing.focalY} idPrefix="closing" />
          </SectionForm>

          {canContact ? (
            <SectionForm settingKey="contact">
              <div className="adm-callout">
                <Info size={18} />
                <p>Vul alleen gegevens in die van Goed Geregeld zelf zijn. Een leeg e-mailadres wordt nergens getoond.</p>
              </div>
              <div className="adm-form-grid">
                <TextField id="c-wa" name="whatsapp" label="WhatsApp-nummer" hint="Internationaal, alleen cijfers, bijv. 316…" defaultValue={content.contact.whatsapp} max={15} />
                <TextField id="c-phone" name="phoneDisplay" label="Telefoonnummer zoals getoond" defaultValue={content.contact.phoneDisplay} max={24} />
                <TextField id="c-ig" name="instagramUrl" label="Instagram-link" defaultValue={content.contact.instagramUrl} max={120} />
                <TextField id="c-igh" name="instagramHandle" label="Instagram-naam" defaultValue={content.contact.instagramHandle} max={40} />
                <TextField id="c-city" name="city" label="Plaats" defaultValue={content.contact.city} max={40} />
                <TextField id="c-email" name="email" label="E-mailadres" hint="Leeg laten tot het adres bevestigd is." defaultValue={content.contact.email} max={120} />
              </div>
            </SectionForm>
          ) : (
            <div className="adm-callout">
              <Info size={18} />
              <p>Contactgegevens kunnen alleen door de eigenaar worden gewijzigd.</p>
            </div>
          )}

          <SectionForm settingKey="footer">
            <TextField id="f-tag" name="tagline" label="Regel onder het logo" defaultValue={content.footer.tagline} max={160} rows={2} />
            <TextField id="f-legal" name="legalNote" label="Juridische opmerking" defaultValue={content.footer.legalNote} max={260} rows={2} />
          </SectionForm>
        </div>
      ) : null}

      {tab === 'faq' ? <FaqTab /> : null}
      {tab === 'paginas' ? <PagesTab canApprove={canApprove} /> : null}
      {tab === 'versies' ? <RevisionsTab /> : null}
    </>
  )
}

async function FaqTab() {
  const list = await getDb().select().from(faqs).orderBy(asc(faqs.sortOrder), asc(faqs.createdAt))
  const topicLabel = new Map<string, string>(FAQ_TOPICS.map((t) => [t.key, t.label]))
  const form = (f?: (typeof list)[number]) => (
    <ActionForm action={saveFaqAction} className="adm-form" resetOnSuccess={!f} aria-label={f ? `Vraag bewerken: ${f.question}` : 'Nieuwe vraag'}>
      {f ? <input type="hidden" name="faqId" value={f.id} /> : null}
      <div className="adm-form-grid">
        <div className="field is-wide">
          <label className="field__label" htmlFor={`q-${f?.id ?? 'nieuw'}`}>
            Vraag
          </label>
          <input className="input" id={`q-${f?.id ?? 'nieuw'}`} name="question" defaultValue={f?.question ?? ''} maxLength={160} />
          <FieldError name="question" />
        </div>
        <div className="field is-wide">
          <label className="field__label" htmlFor={`a-${f?.id ?? 'nieuw'}`}>
            Antwoord
          </label>
          <textarea className="textarea" id={`a-${f?.id ?? 'nieuw'}`} name="answer" rows={4} defaultValue={f?.answer ?? ''} maxLength={1300} />
          <p className="field__hint">Alleen bevestigde informatie. Tekst tussen [vierkante haken] blokkeert publiceren.</p>
          <FieldError name="answer" />
        </div>
        <div className="field">
          <label className="field__label" htmlFor={`t-${f?.id ?? 'nieuw'}`}>
            Onderwerp
          </label>
          <select className="select" id={`t-${f?.id ?? 'nieuw'}`} name="topic" defaultValue={f?.topic ?? 'overig'}>
            {FAQ_TOPICS.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="field__label" htmlFor={`s-${f?.id ?? 'nieuw'}`}>
            Status
          </label>
          <select className="select" id={`s-${f?.id ?? 'nieuw'}`} name="status" defaultValue={f?.status ?? 'concept'}>
            <option value="concept">Concept (niet zichtbaar)</option>
            <option value="gepubliceerd">Gepubliceerd</option>
          </select>
        </div>
      </div>
      <FormMessage />
      <div className="adm-form-actions">
        <SubmitButton>{f ? 'Opslaan' : 'Vraag toevoegen'}</SubmitButton>
      </div>
    </ActionForm>
  )
  return (
    <div className="adm-grid">
      <section className="adm-panel" aria-labelledby="faq-nieuw">
        <h2 id="faq-nieuw" className="adm-section-title">
          Vraag toevoegen
        </h2>
        {form()}
      </section>
      {list.map((f, i) => (
        <article key={f.id} className="adm-panel">
          <div className="adm-panel__head">
            <h3 className="adm-section-title">{f.question}</h3>
            <span className="adm-chips">
              <span className="chip">{topicLabel.get(f.topic) ?? f.topic}</span>
              {f.status === 'gepubliceerd' ? (
                <span className="adm-badge tone-ok">
                  <Check size={12} /> Gepubliceerd
                </span>
              ) : (
                <span className="adm-badge tone-info">
                  <Info size={12} /> Concept
                </span>
              )}
              {hasPlaceholder(f.answer) ? (
                <span className="adm-badge tone-warn">
                  <Alert size={12} /> Nog aan te vullen
                </span>
              ) : null}
            </span>
          </div>
          <details>
            <summary className="btn btn--ghost btn--sm">Bewerken</summary>
            <div style={{ marginTop: '1rem' }}>{form(f)}</div>
          </details>
          <ActionForm action={faqCommandAction} className="adm-chips" aria-label={`Acties voor ${f.question}`}>
            {i > 0 ? (
              <SubmitButton name="command" value={`omhoog:${f.id}`} variant="ghost">
                ↑<span className="visually-hidden"> Omhoog</span>
              </SubmitButton>
            ) : null}
            {i < list.length - 1 ? (
              <SubmitButton name="command" value={`omlaag:${f.id}`} variant="ghost">
                ↓<span className="visually-hidden"> Omlaag</span>
              </SubmitButton>
            ) : null}
            <ConfirmSubmit label="Verwijderen" title="Vraag verwijderen?" description="De vraag verdwijnt van de website." confirmLabel="Verwijderen" name="command" value={`verwijderen:${f.id}`} />
            <FormMessage />
          </ActionForm>
        </article>
      ))}
    </div>
  )
}

async function PagesTab({ canApprove }: { canApprove: boolean }) {
  const list = await getDb().select().from(pages).orderBy(asc(pages.slug))
  return (
    <div className="adm-grid">
      <div className="adm-callout">
        <Info size={18} />
        <p>
          Deze pagina’s verschijnen pas op de website (en in de footer) als de eigenaar ze goedkeurt. Gebruik ‘## ’ voor een kopje en een lege
          regel voor een nieuwe alinea. Laat de tekst juridisch controleren.
        </p>
      </div>
      {list.map((p) => (
        <section key={p.slug} className="adm-panel" aria-labelledby={`pagina-${p.slug}`}>
          <div className="adm-panel__head">
            <h2 id={`pagina-${p.slug}`} className="adm-section-title">
              {p.title}
            </h2>
            <span className="adm-chips">
              {p.status === 'gepubliceerd' ? (
                <span className="adm-badge tone-ok">
                  <Check size={12} /> Gepubliceerd{p.approvedAt ? ` · goedgekeurd ${formatDateTimeShort(p.approvedAt)}` : ''}
                </span>
              ) : (
                <span className="adm-badge tone-info">
                  <Info size={12} /> Concept
                </span>
              )}
              {hasPlaceholder(p.body) ? (
                <span className="adm-badge tone-warn">
                  <Alert size={12} /> Bevat nog [aan te vullen] tekst
                </span>
              ) : null}
            </span>
          </div>
          {p.status === 'gepubliceerd' && !canApprove ? (
            <>
              <p className="adm-note">
                <Info size={16} />
                <span>Goedgekeurd door de eigenaar. Alleen de eigenaar kan deze tekst nog wijzigen.</span>
              </p>
              <div className="adm-legal-preview" tabIndex={0} role="region" aria-label={`Goedgekeurde tekst: ${p.title}`}>
                {p.body}
              </div>
            </>
          ) : (
            <ActionForm action={savePageAction} className="adm-form" aria-label={p.title}>
              <input type="hidden" name="slug" value={p.slug} />
              <div className="field">
                <label className="field__label" htmlFor={`pt-${p.slug}`}>
                  Titel
                </label>
                <input className="input" id={`pt-${p.slug}`} name="title" defaultValue={p.title} maxLength={80} />
                <FieldError name="title" />
              </div>
              <div className="field">
                <label className="field__label" htmlFor={`pb-${p.slug}`}>
                  Tekst
                </label>
                <textarea className="textarea" id={`pb-${p.slug}`} name="body" rows={14} defaultValue={p.body} />
                <FieldError name="body" />
              </div>
              <FormMessage />
              <div className="adm-form-actions">
                <SubmitButton variant="secondary">{p.status === 'gepubliceerd' ? 'Wijziging opslaan en goedkeuren' : 'Opslaan'}</SubmitButton>
                {canApprove && p.status !== 'gepubliceerd' ? (
                  <SubmitButton name="intent" value="publiceren">
                    Goedkeuren en publiceren
                  </SubmitButton>
                ) : null}
                {canApprove && p.status === 'gepubliceerd' ? (
                  <SubmitButton name="intent" value="depubliceren" variant="ghost">
                    Offline halen
                  </SubmitButton>
                ) : null}
              </div>
            </ActionForm>
          )}
        </section>
      ))}
    </div>
  )
}

async function RevisionsTab() {
  const rows = await getDb()
    .select({ id: revisions.id, entityId: revisions.entityId, createdAt: revisions.createdAt, by: users.name })
    .from(revisions)
    .leftJoin(users, eq(users.id, revisions.actorId))
    .where(and(eq(revisions.entityType, 'instelling'), inArray(revisions.entityId, ['hero', 'marquee', 'fleetIntro', 'signature', 'process', 'about', 'faqIntro', 'closing', 'contact', 'footer'])))
    .orderBy(desc(revisions.createdAt))
    .limit(40)
  return (
    <section className="adm-panel" aria-labelledby="versies-titel">
      <h2 id="versies-titel" className="adm-section-title">
        Eerdere versies van homepage-secties
      </h2>
      <p className="adm-small">Bij elke wijziging wordt de vorige versie bewaard. Herstellen bewaart eerst de huidige versie.</p>
      {rows.length ? (
        <ul className="adm-list">
          {rows.map((r) => (
            <li key={r.id}>
              <div>
                <strong>{SETTING_LABELS[r.entityId as SettingKey] ?? r.entityId}</strong>
                <p className="adm-small">
                  Versie van vóór de wijziging van {formatDateTimeShort(r.createdAt)} door {r.by ?? 'onbekend'}
                </p>
              </div>
              <ActionForm action={restoreSettingAction} aria-label="Versie herstellen">
                <input type="hidden" name="revisionId" value={r.id} />
                <ConfirmSubmit
                  label="Herstellen"
                  title="Deze versie herstellen?"
                  description="De huidige tekst wordt vervangen; die blijft als versie bewaard."
                  confirmLabel="Herstellen"
                  name="bevestig"
                  value={r.id}
                  variant="secondary"
                />
                <FormMessage />
              </ActionForm>
            </li>
          ))}
        </ul>
      ) : (
        <p className="adm-small">Nog geen eerdere versies.</p>
      )}
    </section>
  )
}
