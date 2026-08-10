function fingerprint(value: unknown): string {
  return JSON.stringify(value)
}

function cloneState<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

export function useDraftDirty<T>(state: Ref<T>) {
  const savedFingerprint = ref(fingerprint(state.value))
  const isDirty = computed(() => fingerprint(state.value) !== savedFingerprint.value)

  function hydrate(value: T) {
    const cleanValue = cloneState(value)
    state.value = cleanValue
    savedFingerprint.value = fingerprint(cleanValue)
  }

  function markSaved() {
    savedFingerprint.value = fingerprint(state.value)
  }

  return { isDirty, hydrate, markSaved }
}
