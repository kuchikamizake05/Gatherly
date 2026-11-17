// Only mock callbacks call this store. Real API requests never read fixture state.
export function readMock<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return structuredClone(fallback);
  try {
    const value = localStorage.getItem(`gatherly.mock.${key}`);
    return value ? (JSON.parse(value) as T) : structuredClone(fallback);
  } catch {
    return structuredClone(fallback);
  }
}

export function writeMock<T>(key: string, value: T): T {
  if (typeof window !== "undefined")
    localStorage.setItem(`gatherly.mock.${key}`, JSON.stringify(value));
  return value;
}
