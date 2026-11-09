import { projectError } from "../errors/framework-errors.ts";

export type ColumnType =
  | "text"
  | "boolean"
  | "timestamptz"
  | "integer"
  | "bigint"
  | "numeric"
  | "jsonb";

export type DomainColumn = {
  name: string;
  type: ColumnType;
  nullable: boolean;
};

export type TableSchema = {
  name: string;
  columns: DomainColumn[];
};

const reservedTypes = {
  _id: "text",
  _object: "text",
  _tenant: "text",
  _archived: "boolean",
  _createdAt: "timestamptz",
  _updatedAt: "timestamptz",
} as const;

const typePatterns: readonly { pattern: RegExp; type: ColumnType }[] = [
  { pattern: /^timestamptz\b/i, type: "timestamptz" },
  { pattern: /^timestamp\s+with\s+time\s+zone\b/i, type: "timestamptz" },
  { pattern: /^boolean\b/i, type: "boolean" },
  { pattern: /^bool\b/i, type: "boolean" },
  { pattern: /^bigint\b/i, type: "bigint" },
  { pattern: /^int8\b/i, type: "bigint" },
  { pattern: /^integer\b/i, type: "integer" },
  { pattern: /^int4\b/i, type: "integer" },
  { pattern: /^int\b/i, type: "integer" },
  { pattern: /^numeric\b/i, type: "numeric" },
  { pattern: /^decimal\b/i, type: "numeric" },
  { pattern: /^jsonb\b/i, type: "jsonb" },
  { pattern: /^text\b/i, type: "text" },
  { pattern: /^varchar\b/i, type: "text" },
  { pattern: /^character\s+varying\b/i, type: "text" },
];

type ParsedColumn = DomainColumn;

type WorkingTable = {
  name: string;
  reserved: Map<string, ParsedColumn>;
  columns: DomainColumn[];
};

export function readTables(files: readonly { file: string; sql: string }[]) {
  const tables = new Map<string, WorkingTable>();
  for (const file of files) {
    for (const statement of statements(stripComments(file.sql))) {
      applyStatement(tables, file.file, statement);
    }
  }
  return [...tables.values()]
    .map((table) => finishTable(table))
    .sort((left, right) => left.name.localeCompare(right.name));
}

function applyStatement(
  tables: Map<string, WorkingTable>,
  file: string,
  statement: string,
) {
  const create = statement.match(
    /^create\s+table\s+(?:if\s+not\s+exists\s+)?([\s\S]+)$/i,
  );
  if (create?.[1]) {
    createTable(tables, file, create[1]);
    return;
  }
  const alter = statement.match(
    /^alter\s+table\s+(.+?)\s+add\s+(?:column\s+)?(?:if\s+not\s+exists\s+)?([\s\S]+)$/i,
  );
  if (alter?.[1] && alter[2]) {
    addColumn(tables, file, alter[1].trim(), alter[2].trim());
  }
}

function createTable(
  tables: Map<string, WorkingTable>,
  file: string,
  rest: string,
) {
  const open = rest.indexOf("(");
  const close = rest.lastIndexOf(")");
  if (open === -1 || close === -1 || close < open) {
    throw projectError(
      "invalidRepositorySql",
      `${file} has a CREATE TABLE Keja cannot read`,
    );
  }
  const name = tableName(rest.slice(0, open).trim(), file);
  if (tables.has(name)) {
    throw projectError(
      "invalidRepositorySql",
      `${file} creates ${name} more than once`,
    );
  }
  const table: WorkingTable = {
    name,
    reserved: new Map(),
    columns: [],
  };
  for (const part of splitTopLevel(rest.slice(open + 1, close))) {
    if (isConstraint(part)) {
      continue;
    }
    const column = readColumn(part, file, name);
    storeColumn(table, column, file);
  }
  tables.set(name, table);
}

function addColumn(
  tables: Map<string, WorkingTable>,
  file: string,
  tableToken: string,
  definition: string,
) {
  const name = tableName(tableToken, file);
  const table = tables.get(name);
  if (!table) {
    throw projectError(
      "invalidRepositorySql",
      `${file} adds a column to missing table ${name}`,
    );
  }
  const column = readColumn(definition, file, name);
  storeColumn(table, column, file);
}

function storeColumn(table: WorkingTable, column: ParsedColumn, file: string) {
  if (column.name in reservedTypes) {
    if (table.reserved.has(column.name)) {
      throw projectError(
        "invalidRepositorySql",
        `${file} defines ${table.name}.${column.name} more than once`,
      );
    }
    table.reserved.set(column.name, column);
    return;
  }
  if (column.name.startsWith("_")) {
    throw projectError(
      "invalidRepositorySql",
      `${file} column ${table.name}.${column.name} is reserved`,
    );
  }
  if (table.columns.some((item) => item.name === column.name)) {
    throw projectError(
      "invalidRepositorySql",
      `${file} defines ${table.name}.${column.name} more than once`,
    );
  }
  table.columns.push(column);
}

function finishTable(table: WorkingTable): TableSchema {
  for (const [name, type] of Object.entries(reservedTypes)) {
    const column = table.reserved.get(name);
    if (!column || column.nullable || column.type !== type) {
      throw projectError(
        "invalidRepositorySql",
        `${table.name}.${name} must be ${type} not null`,
      );
    }
  }
  return { name: table.name, columns: table.columns };
}

function readColumn(definition: string, file: string, table: string) {
  const ident = readIdent(definition.trim());
  if (!ident) {
    throw projectError(
      "invalidRepositorySql",
      `${file} has a column in ${table} Keja cannot read`,
    );
  }
  const mapped = typePatterns.find((item) => item.pattern.test(ident.rest));
  if (!mapped) {
    throw projectError(
      "invalidRepositorySql",
      `${file} column ${table}.${ident.name} has no TypeScript type`,
    );
  }
  const nullable = !/\b(?:not\s+null|primary\s+key)\b/i.test(ident.rest);
  return { name: ident.name, type: mapped.type, nullable };
}

function tableName(token: string, file: string) {
  const parts = token
    .trim()
    .split(".")
    .map((part) => readIdent(part.trim())?.name)
    .filter((part): part is string => part !== undefined);
  const name = parts.at(-1);
  if (!name || !/^[a-z_][a-z0-9_]*$/.test(name)) {
    throw projectError(
      "invalidRepositorySql",
      `${file} has a table name Keja cannot read`,
    );
  }
  return name;
}

function isConstraint(part: string) {
  return /^(?:check|constraint|primary|unique|foreign)\b/i.test(part.trim());
}

function readIdent(value: string) {
  const quoted = value.match(/^"([^"]+)"(.*)$/s);
  if (quoted?.[1] !== undefined) {
    return { name: quoted[1], rest: quoted[2]?.trim() ?? "" };
  }
  const plain = value.match(/^([A-Za-z_][A-Za-z0-9_]*)(.*)$/s);
  if (!plain?.[1]) {
    return null;
  }
  return { name: plain[1].toLowerCase(), rest: plain[2]?.trim() ?? "" };
}

function stripComments(sql: string) {
  return sql.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/--.*$/gm, " ");
}

function statements(sql: string) {
  return splitTopLevel(sql, ";").filter((statement) => statement.trim() !== "");
}

function splitTopLevel(value: string, separator = ",") {
  const parts: string[] = [];
  let current = "";
  let depth = 0;
  let quote: "'" | '"' | null = null;
  for (let index = 0; index < value.length; index++) {
    const char = value[index] ?? "";
    if (quote) {
      current += char;
      if (char === quote && value[index + 1] === quote) {
        current += value[index + 1];
        index += 1;
        continue;
      }
      if (char === quote) {
        quote = null;
      }
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      current += char;
      continue;
    }
    if (char === "(") {
      depth += 1;
    }
    if (char === ")") {
      depth -= 1;
    }
    if (char === separator && depth === 0) {
      parts.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  if (current.trim()) {
    parts.push(current.trim());
  }
  return parts;
}
