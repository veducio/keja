import { Chalk } from "chalk";

export function formatSeed(
  results: readonly { table: string; inserted: number }[],
  color = false,
) {
  const style = new Chalk({ level: color ? 1 : 0 });
  const row = (label: string, value: string) =>
    `  ${style.dim(`- ${label.padEnd(10)}`)} ${value}`;
  const lines =
    results.length > 0
      ? results.map((result) => row(result.table, String(result.inserted)))
      : [row("Seeders", "none")];
  return `\n  ${style.dim("SEED")}\n\n${lines.join("\n")}\n`;
}
