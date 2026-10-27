'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'
import { ActionForm, FieldError, FormMessage, SubmitButton } from '@/components/admin/ActionForm'
import { INITIAL_STATE } from '@/components/admin/action-state'
import { ConfirmSubmit } from '@/components/admin/ConfirmSubmit'
import { fitUpload, formatMb } from '@/components/admin/fit-upload'
import { Alert, Check, Hexagon } from '@/components/icons'
import { photoCommandAction, reorderPhotosAction, replacePhotoAction, updatePhotoAction, uploadPhotoAction } from '../actions'

export type AdminPhoto = {
  id: string
  src: string
  width: number
  height: number
  alt: string
  focalX: number
  focalY: number
  isPublic: boolean
  isPrimary: boolean
  note: string | null
  originalName: string | null
  bytes: number
}

const ACCEPT = 'image/jpeg,image/png,image/webp,image/avif'
const MAX_BYTES = 12 * 1024 * 1024

type UploadItem = { key: string; name: string; preview: string; status: 'wacht' | 'bezig' | 'klaar' | 'fout'; message?: string }

type Props = {
  vehicleId: string
  photos: AdminPhoto[]
  canEdit: boolean
  /** Grootste bestand per verzoek; grotere foto’s worden eerst in de browser verkleind. */
  uploadLimit: number
}

export function PhotoManager({ vehicleId, photos, canEdit, uploadLimit }: Props) {
  const router = useRouter()
  const [uploads, setUploads] = useState<UploadItem[]>([])
  const [busy, setBusy] = useState(false)
  const [order, setOrder] = useState(photos.map((p) => p.id))
  const [dragId, setDragId] = useState<string | null>(null)
  const [orderMessage, setOrderMessage] = useState('')
  const [, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)
  const previewUrls = useRef<string[]>([])

  useEffect(() => setOrder(photos.map((p) => p.id)), [photos])
  // Voorvertoningen pas vrijgeven bij een nieuwe selectie of bij het verlaten van de pagina.
  useEffect(() => () => previewUrls.current.forEach((u) => URL.revokeObjectURL(u)), [])

  const shrinks = uploadLimit < MAX_BYTES
  const tooLarge = `Groter dan ${formatMb(uploadLimit)} MB en niet te verkleinen; exporteer als JPEG en probeer opnieuw`

  const byId = new Map(photos.map((p) => [p.id, p]))
  const ordered = order.map((id) => byId.get(id)).filter((p): p is AdminPhoto => Boolean(p))

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return
    previewUrls.current.forEach((u) => URL.revokeObjectURL(u))
    const items: UploadItem[] = Array.from(files).map((f, i) => ({
      key: `${Date.now()}-${i}`,
      name: f.name,
      preview: URL.createObjectURL(f),
      status: 'wacht',
      ...(f.size > MAX_BYTES ? { status: 'fout' as const, message: 'Groter dan 12 MB' } : {}),
      ...(!ACCEPT.split(',').includes(f.type) && f.type ? { status: 'fout' as const, message: 'Geen JPEG, PNG, WebP of AVIF' } : {}),
    }))
    previewUrls.current = items.map((it) => it.preview)
    setUploads(items)
    setBusy(true)
    const list = Array.from(files)
    for (let i = 0; i < list.length; i++) {
      if (items[i]!.status === 'fout') continue
      setUploads((prev) => prev.map((u, j) => (j === i ? { ...u, status: 'bezig' } : u)))
      let file: File
      try {
        file = await fitUpload(list[i]!, uploadLimit)
      } catch {
        setUploads((prev) => prev.map((u, j) => (j === i ? { ...u, status: 'fout', message: tooLarge } : u)))
        continue
      }
      const fd = new FormData()
      fd.set('vehicleId', vehicleId)
      fd.set('file', file)
      try {
        const res = await uploadPhotoAction(INITIAL_STATE, fd)
        setUploads((prev) => prev.map((u, j) => (j === i ? { ...u, status: res.ok ? 'klaar' : 'fout', message: res.ok ? undefined : res.message } : u)))
      } catch {
        setUploads((prev) => prev.map((u, j) => (j === i ? { ...u, status: 'fout', message: 'Upload mislukt' } : u)))
      }
    }
    setBusy(false)
    if (inputRef.current) inputRef.current.value = ''
    router.refresh()
  }

  const saveOrder = (ids: string[]) => {
    setOrder(ids)
    startTransition(async () => {
      const res = await reorderPhotosAction(vehicleId, ids)
      setOrderMessage(res.message ?? '')
      router.refresh()
    })
  }

  const onDrop = (targetId: string) => {
    if (!dragId || dragId === targetId) return
    const ids = order.filter((id) => id !== dragId)
    ids.splice(ids.indexOf(targetId), 0, dragId)
    setDragId(null)
    saveOrder(ids)
  }

  return (
    <div className="adm-grid">
      {canEdit ? (
        <section className="adm-panel" aria-labelledby="upload-titel">
          <h2 id="upload-titel" className="adm-section-title">
            Foto’s toevoegen
          </h2>
          <p className="adm-small">
            JPEG, PNG, WebP of AVIF, maximaal 12 MB per bestand en minimaal 400 pixels aan de korte kant. Het origineel wordt bewaard; de website
            gebruikt automatisch geoptimaliseerde versies. Watermerken en tekst in beeld blijven zoals ze zijn.
          </p>
          {shrinks ? (
            <p className="adm-small" id="upload-limiet">
              Deze hosting neemt maximaal {formatMb(uploadLimit)} MB per keer aan. Grotere foto’s verkleint je browser eerst (JPEG, hooguit 4000 pixels
              aan de lange kant); die versie wordt dan als origineel bewaard. De website toont foto’s op maximaal 1920 pixels breed.
            </p>
          ) : null}
          <div className="field">
            <label className="field__label" htmlFor="upload">
              Kies een of meer foto’s
            </label>
            <input ref={inputRef} className="input" id="upload" type="file" accept={ACCEPT} multiple disabled={busy} onChange={(e) => onFiles(e.target.files)} />
          </div>
          {uploads.length ? (
            <ul className="adm-upload-list" aria-live="polite">
              {uploads.map((u) => (
                <li key={u.key}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={u.preview} alt="" width={56} height={56} />
                  <span className="adm-upload-name">{u.name}</span>
                  <span className={`adm-badge ${u.status === 'klaar' ? 'tone-ok' : u.status === 'fout' ? 'tone-danger' : 'tone-info'}`}>
                    {u.status === 'klaar' ? <Check size={12} /> : u.status === 'fout' ? <Alert size={12} /> : null}
                    {u.status === 'wacht' ? 'In de wachtrij' : u.status === 'bezig' ? 'Bezig met verwerken…' : u.status === 'klaar' ? 'Toegevoegd' : (u.message ?? 'Mislukt')}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      <section aria-labelledby="fotos-titel">
        <div className="adm-panel__head" style={{ marginBottom: '0.75rem' }}>
          <h2 id="fotos-titel" className="adm-section-title">
            Foto’s ({ordered.length})
          </h2>
          <p className="adm-small" role="status">
            {orderMessage || (canEdit ? 'Sleep een foto om de volgorde te wijzigen, of gebruik de pijlknoppen.' : '')}
          </p>
        </div>
        {ordered.length === 0 ? <p className="adm-small">Nog geen foto’s.</p> : null}
        <ol className="adm-photos">
          {ordered.map((p, i) => (
            <li
              key={p.id}
              className={`adm-photo ${dragId === p.id ? 'is-dragging' : ''}`}
              draggable={canEdit}
              onDragStart={() => setDragId(p.id)}
              onDragEnd={() => setDragId(null)}
              onDragOver={(e) => canEdit && e.preventDefault()}
              onDrop={() => onDrop(p.id)}
            >
              <PhotoCard photo={p} index={i} total={ordered.length} canEdit={canEdit} uploadLimit={uploadLimit} />
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}

function PhotoCard({
  photo,
  index,
  total,
  canEdit,
  uploadLimit,
}: {
  photo: AdminPhoto
  index: number
  total: number
  canEdit: boolean
  uploadLimit: number
}) {
  const [focal, setFocal] = useState({ x: photo.focalX, y: photo.focalY })
  useEffect(() => setFocal({ x: photo.focalX, y: photo.focalY }), [photo.focalX, photo.focalY])

  const pick = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!canEdit) return
    const rect = e.currentTarget.getBoundingClientRect()
    setFocal({
      x: Math.round(((e.clientX - rect.left) / rect.width) * 100),
      y: Math.round(((e.clientY - rect.top) / rect.height) * 100),
    })
  }

  return (
    <div className="adm-photo__inner">
      <div className="adm-photo__media">
        <div className="adm-focal">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.src} alt={photo.alt} width={photo.width} height={photo.height} onClick={pick} loading="lazy" />
          <span className="adm-focal__marker" style={{ left: `${focal.x}%`, top: `${focal.y}%` }} aria-hidden="true" />
        </div>
        <div className="adm-crops" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.src} alt="" style={{ aspectRatio: '4 / 5', objectPosition: `${focal.x}% ${focal.y}%` }} loading="lazy" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.src} alt="" style={{ aspectRatio: '4 / 3', objectPosition: `${focal.x}% ${focal.y}%` }} loading="lazy" />
        </div>
      </div>

      <div className="adm-photo__meta">
        <p className="adm-chips">
          <span className="adm-small adm-mono">#{index + 1}</span>
          {photo.isPrimary ? (
            <span className="adm-badge tone-ok">
              <Hexagon size={12} /> Hoofdfoto
            </span>
          ) : null}
          {photo.isPublic ? (
            <span className="adm-badge tone-info">
              <Check size={12} /> Publiek
            </span>
          ) : (
            <span className="adm-badge tone-warn">
              <Alert size={12} /> Niet publiek
            </span>
          )}
          {!photo.alt ? (
            <span className="adm-badge tone-danger">
              <Alert size={12} /> Alt-tekst ontbreekt
            </span>
          ) : null}
        </p>
        {photo.note ? <p className="adm-callout is-warn adm-small">{photo.note}</p> : null}
        <p className="adm-small">
          {photo.originalName ?? 'Foto'} · {photo.width} × {photo.height} · {(photo.bytes / 1024 / 1024).toFixed(1)} MB
        </p>

        {canEdit ? (
          <>
            <ActionForm action={updatePhotoAction} className="adm-form" aria-label={`Foto ${index + 1} bewerken`}>
              <input type="hidden" name="mediaId" value={photo.id} />
              <div className="field">
                <label className="field__label" htmlFor={`alt-${photo.id}`}>
                  Alt-tekst
                </label>
                <textarea className="textarea" id={`alt-${photo.id}`} name="alt" rows={2} maxLength={200} defaultValue={photo.alt} style={{ minHeight: '4.5rem' }} />
                <p className="field__hint">Beschrijf wat er zichtbaar is, bijvoorbeeld kleur, hoek en bijzonderheden.</p>
                <FieldError name="alt" />
              </div>
              <div className="adm-form-grid">
                <div className="field">
                  <label className="field__label" htmlFor={`fx-${photo.id}`}>
                    Focuspunt horizontaal (%)
                  </label>
                  <input className="input" type="number" min={0} max={100} id={`fx-${photo.id}`} name="focalX" value={focal.x} onChange={(e) => setFocal((f) => ({ ...f, x: Number(e.target.value) }))} />
                </div>
                <div className="field">
                  <label className="field__label" htmlFor={`fy-${photo.id}`}>
                    Focuspunt verticaal (%)
                  </label>
                  <input className="input" type="number" min={0} max={100} id={`fy-${photo.id}`} name="focalY" value={focal.y} onChange={(e) => setFocal((f) => ({ ...f, y: Number(e.target.value) }))} />
                </div>
              </div>
              <p className="field__hint">Klik op de foto om het focuspunt te kiezen. Rechts zie je de uitsnede voor kaarten (staand en liggend).</p>
              <label className="adm-check">
                <input type="checkbox" name="isPublic" defaultChecked={photo.isPublic} />
                <span>Publiek tonen op de website</span>
              </label>
              <div className="adm-form-actions">
                <SubmitButton variant="secondary">Opslaan</SubmitButton>
              </div>
              <FormMessage />
            </ActionForm>

            <ActionForm action={photoCommandAction} className="adm-chips" aria-label={`Acties foto ${index + 1}`}>
              <SubmitButton name="command" value={`omhoog:${photo.id}`} variant="ghost" className={index === 0 ? 'visually-hidden' : ''}>
                ↑<span className="visually-hidden"> Foto {index + 1} naar voren</span>
              </SubmitButton>
              <SubmitButton name="command" value={`omlaag:${photo.id}`} variant="ghost" className={index === total - 1 ? 'visually-hidden' : ''}>
                ↓<span className="visually-hidden"> Foto {index + 1} naar achteren</span>
              </SubmitButton>
              {!photo.isPrimary ? (
                <SubmitButton name="command" value={`hoofdfoto:${photo.id}`} variant="ghost">
                  Als hoofdfoto
                </SubmitButton>
              ) : null}
              <ConfirmSubmit
                label="Verwijderen"
                title="Foto verwijderen?"
                description="De foto en alle webversies worden verwijderd. Dit kan niet ongedaan worden gemaakt."
                confirmLabel="Verwijderen"
                name="command"
                value={`verwijderen:${photo.id}`}
              />
              <FormMessage />
            </ActionForm>

            <ActionForm action={replacePhotoAction} className="adm-form" aria-label={`Foto ${index + 1} vervangen`}>
              <input type="hidden" name="mediaId" value={photo.id} />
              <div className="field">
                <label className="field__label" htmlFor={`replace-${photo.id}`}>
                  Foto vervangen
                </label>
                <ReplaceInput id={`replace-${photo.id}`} limit={uploadLimit} />
              </div>
              <div className="adm-form-actions">
                <SubmitButton variant="ghost" pendingText="Bezig met verwerken…">
                  Vervangen
                </SubmitButton>
              </div>
              <FormMessage />
            </ActionForm>
          </>
        ) : null}
      </div>
    </div>
  )
}

/** Bestandskeuze voor ‘Foto vervangen’: verkleint een te groot bestand vóór het verzenden. */
function ReplaceInput({ id, limit }: { id: string; limit: number }) {
  const [note, setNote] = useState('')
  const onChange = async (input: HTMLInputElement) => {
    const file = input.files?.[0]
    setNote('')
    if (!file) return
    if (file.size > MAX_BYTES) {
      input.value = ''
      setNote('Het bestand is groter dan 12 MB.')
      return
    }
    if (file.size <= limit) return
    setNote('Bezig met verkleinen…')
    try {
      const small = await fitUpload(file, limit)
      const list = new DataTransfer()
      list.items.add(small)
      input.files = list.files
      setNote(`Verkleind tot ${formatMb(small.size)} MB voor het uploaden.`)
    } catch {
      input.value = ''
      setNote(`Dit bestand is groter dan ${formatMb(limit)} MB en kon niet worden verkleind. Exporteer het als JPEG en probeer opnieuw.`)
    }
  }
  return (
    <>
      <input
        className="input"
        type="file"
        id={id}
        name="file"
        accept={ACCEPT}
        aria-describedby={note ? `${id}-melding` : undefined}
        onChange={(e) => onChange(e.currentTarget)}
      />
      <p id={`${id}-melding`} className="adm-small" role="status">
        {note}
      </p>
    </>
  )
}
