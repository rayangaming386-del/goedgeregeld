/**
 * Rollen en rechten. Wordt server-side afgedwongen in elke beheerpagina en
 * elke Server Action; de interface verbergt daarnaast wat niet mag.
 */

export const ROLES = ['eigenaar', 'medewerker', 'redacteur'] as const
export type Role = (typeof ROLES)[number]

export const ROLE_LABELS: Record<Role, string> = {
  eigenaar: 'Eigenaar',
  medewerker: 'Medewerker',
  redacteur: 'Redacteur',
}

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  eigenaar: 'Volledig beheer, inclusief prijzen, acties, gebruikers en livegang.',
  medewerker: 'Aanvragen, reserveringen, kalender en blokkades.',
  redacteur: 'Auto’s, foto’s en website-inhoud. Geen prijzen of planning.',
}

export const PERMISSIONS = [
  'dashboard:bekijken',
  'aanvragen:bekijken',
  'aanvragen:beheren',
  'planning:beheren',
  'wagenpark:bekijken',
  'wagenpark:bewerken',
  'wagenpark:publiceren',
  'wagenpark:archiveren',
  'prijzen:beheren',
  'brongegevens:bevestigen',
  'media:beheren',
  'acties:beheren',
  'inhoud:beheren',
  'paginas:goedkeuren',
  'instellingen:beheren',
  'gebruikers:beheren',
  'geschiedenis:bekijken',
] as const

export type Permission = (typeof PERMISSIONS)[number]

const MATRIX: Record<Role, readonly Permission[]> = {
  eigenaar: PERMISSIONS,
  medewerker: [
    'dashboard:bekijken',
    'aanvragen:bekijken',
    'aanvragen:beheren',
    'planning:beheren',
    'wagenpark:bekijken',
  ],
  redacteur: [
    'dashboard:bekijken',
    'wagenpark:bekijken',
    'wagenpark:bewerken',
    'wagenpark:publiceren',
    'media:beheren',
    'inhoud:beheren',
  ],
}

export function can(role: Role | null | undefined, permission: Permission): boolean {
  if (!role) return false
  return MATRIX[role]?.includes(permission) ?? false
}

export function permissionsFor(role: Role): readonly Permission[] {
  return MATRIX[role]
}

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value)
}
