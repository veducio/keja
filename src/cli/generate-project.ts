import { Chalk } from "chalk";
import { generateRepositories } from "../repository/generate.ts";
import { formatProjectFailure, readProjectFailure } from "./run-project.ts";

export function formatGenerate(
  output: string,
  tables: readonly string[],
  color = false,
) {
  const style = new Chalk({ level: color ? 1 : 0 });
  const row = (label: string, value: string) =>
    `  ${style.dim(`- ${label.padEnd(10)}`)} ${value}`;
  const names = tables.length > 0 ? tables.join(", ") : "none";
  return `\n  ${style.dim("GENERATE")}\n\n${row("File", output)}\n${row("Tables", names)}\n`;
}

export async function runGenerate(root = process.cwd()) {
  try {
    const generated = await generateRepositories(root);
    console.log(
      formatGenerate(
        generated.output,
        generated.tables,
        process.stdout.isTTY === true,
      ),
    );
  } catch (error) {
    console.error(
      formatProjectFailure(readProjectFailure(error), {
        wait: false,
        color: process.stderr.isTTY === true,
      }),
    );
    process.exitCode = 1;
  }
  if (process.exitCode === 1) {
    process.exit(1);
  }
}
