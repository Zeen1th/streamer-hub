export function normalizeInstalledFontFamilies(values: readonly string[]): string[] {
  const families = new Map<string, string>();
  for (const value of values) {
    const family = value.trim();
    if (!family) continue;
    const key = family.toLocaleLowerCase('en');
    if (!families.has(key)) families.set(key, family);
  }
  return [...families.values()].sort((left, right) => left.localeCompare(right, 'en', { sensitivity: 'base' }));
}

export function matchInstalledFontFamily(value: string, families: readonly string[]): string | null {
  const key = value.trim().toLocaleLowerCase('en');
  if (!key) return null;
  return families.find((family) => family.toLocaleLowerCase('en') === key) ?? null;
}
