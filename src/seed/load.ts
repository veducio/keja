import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { projectError } from "../errors/framework-errors.ts";
import { isSeeder, type Seeder } from "./define.ts";

export async function loadSeeders(directory: string) {
  if (!existsSync(directory)) {
    return [];
  }
  const files = (await collectSeederFiles(directory)).sort();
  const seeders: Seeder[] = [];
  for (const file of files) {
    const loaded = await import(pathToFileURL(path.join(directory, file)).href);
    seeders.push(...readSeederFile(file, loaded));
  }
  return seeders;
}

export function readSeederFile(file: string, module: object) {
  const exported = seedersFromModule(module);
  if (exported.length === 0) {
    throw projectError(
      "invalidSeederFile",
      `${file} must export defineSeeder(...)`,
    );
  }
  return exported;
}

export function seedersFromModule(module: object) {
  const record = module as Record<string, unknown>;
  const names = Object.keys(record).filter((name) => name !== "default");
  const ordered = "default" in record ? ["default", ...names] : names;
  const seeders: Seeder[] = [];
  for (const name of ordered) {
    const value = record[name];
    if (isSeeder(value)) {
      seeders.push(value);
    }
  }
  return seeders;
}

export async function collectSeederFiles(directory: string) {
  const files = await walk(directory, "");
  return files.filter(
    (file) => file.endsWith(".ts") && !file.endsWith(".test.ts"),
  );
}

async function walk(directory: string, prefix: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      files.push(...(await walk(path.join(directory, entry.name), relative)));
      continue;
    }
    if (entry.isFile()) {
      files.push(relative);
    }
  }
  return files;
}
