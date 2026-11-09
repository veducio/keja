export function processValue<Value extends object>(
  name: string,
  create: () => Value,
) {
  const key = Symbol.for(`keja.${name}`);
  const host = globalThis as Record<symbol, Value | undefined>;
  const existing = host[key];
  if (existing) {
    return existing;
  }
  const created = create();
  host[key] = created;
  return created;
}

export function processBrand(name: string) {
  return Symbol.for(`keja.${name}`);
}
