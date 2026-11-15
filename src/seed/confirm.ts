export function confirmSeedMessage(tables: readonly string[]) {
  const unique = [...new Set(tables)];
  const list = unique.length > 0 ? unique.join(", ") : "no tables";
  return `This will clear ${list} and insert seed data. Continue?`;
}

export async function confirmSeed(options: {
  yes: boolean;
  interactive: boolean;
  tables: readonly string[];
  ask: (message: string) => Promise<string>;
}) {
  if (options.yes) {
    return "yes" as const;
  }
  if (!options.interactive) {
    return "needs-yes" as const;
  }
  const answer = (await options.ask(confirmSeedMessage(options.tables)))
    .trim()
    .toLowerCase();
  return answer === "y" || answer === "yes"
    ? ("yes" as const)
    : ("no" as const);
}
