// Structural diffing so Firestore writes touch only what actually changed
// -- see docs/ARCHITECTURE.md "Firestore sync".

interface WithId {
  id: string
}

function shallowEqual<T extends object>(a: T, b: T): boolean {
  const aKeys = Object.keys(a) as (keyof T)[]
  const bKeys = Object.keys(b) as (keyof T)[]
  if (aKeys.length !== bKeys.length) return false
  return aKeys.every((key) => a[key] === b[key])
}

/** Compares two versions of a flat, id-keyed collection and returns exactly what changed. */
export function diffCollection<T extends WithId>(
  prev: T[],
  next: T[],
): { toWrite: T[]; toDeleteIds: string[] } {
  const prevById = new Map(prev.map((item) => [item.id, item]))
  const nextIds = new Set<string>()
  const toWrite: T[] = []

  for (const item of next) {
    nextIds.add(item.id)
    const previous = prevById.get(item.id)
    if (!previous || !shallowEqual(previous, item)) toWrite.push(item)
  }

  const toDeleteIds = prev.filter((item) => !nextIds.has(item.id)).map((item) => item.id)
  return { toWrite, toDeleteIds }
}
