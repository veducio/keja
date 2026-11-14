import { projectError } from "../errors/framework-errors.ts";

export type ColumnType =
  | "text"
  | "boolean"
  | "timestamptz"
  | "integer"
  | "bigint"
  | "numeric"
  | "jsonb"
  | "enum";

export type DomainColumn =
  | {
      name: string;
      type: Exclude<ColumnType, "enum">;
      nullable: boolean;
    }
  | {
      name: string;
      type: "enum";
      nullable: boolean;
      values: readonly [string, ...string[]];
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

const typePatterns: readonly {
  pattern: RegExp;
  type: Exclude<ColumnType, "enum">;
}[] = [
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

type WorkingColumn =
  | {
      name: string;
      type: Exclude<ColumnType, "enum">;
      nullable: boolean;
    }
  | {
      name: string;
      type: "enum";
      nullable: boolean;
      enumName: string;
    };

type WorkingTable = {
  name: string;
  reserved: Map<string, WorkingColumn>;
  columns: WorkingColumn[];
};

export function readTables(files: readonly { file: string; sql: string }[]) {
  const tables = new Map<string, WorkingTable>();
  const enums = new Map<string, [string, ...string[]]>();
  for (const file of files) {
    for (const statement of statements(stripComments(file.sql))) {
      applyStatement(tables, enums, file.file, statement);
    }
  }
  return [...tables.values()]
    .map((table) => finishTable(table, enums))
    .sort((left, right) => left.name.localeCompare(right.name));
}

function applyStatement(
  tables: Map<string, WorkingTable>,
  enums: Map<string, [string, ...string[]]>,
  file: string,
  statement: string,
) {
  const createType = statement.match(
    /^create\s+type\s+(?:if\s+not\s+exists\s+)?(.+?)\s+as\s+enum\s*\(([\s\S]*)\)\s*$/i,
  );
  if (createType?.[1] && createType[2] !== undefined) {
    createEnum(enums, file, createType[1].trim(), createType[2]);
    return;
  }
  const alterType = statement.match(
    /^alter\s+type\s+(.+?)\s+add\s+value\s+(?:if\s+not\s+exists\s+)?([\s\S]+)$/i,
  );
  if (alterType?.[1] && alterType[2]) {
    addEnumValue(enums, file, alterType[1].trim(), alterType[2].trim());
    return;
  }
  const create = statement.match(
    /^create\s+table\s+(?:if\s+not\s+exists\s+)?([\s\S]+)$/i,
  );
  if (create?.[1]) {
    createTable(tables, enums, file, create[1]);
    return;
  }
  const alter = statement.match(
    /^alter\s+table\s+(.+?)\s+add\s+(?:column\s+)?(?:if\s+not\s+exists\s+)?([\s\S]+)$/i,
  );
  if (alter?.[1] && alter[2]) {
    addColumn(tables, enums, file, alter[1].trim(), alter[2].trim());
  }
}

function createEnum(
  enums: Map<string, [string, ...string[]]>,
  file: string,
  token: string,
  body: string,
) {
  const name = typeName(token, file);
  if (enums.has(name)) {
    throw projectError(
      "invalidRepositorySql",
      `${file} creates type ${name} more than once`,
    );
  }
  const values = readEnumValues(body, file, name);
  enums.set(name, values);
}

function addEnumValue(
  enums: Map<string, [string, ...string[]]>,
  file: string,
  token: string,
  rest: string,
) {
  const name = typeName(token, file);
  const current = enums.get(name);
  if (!current) {
    throw projectError(
      "invalidRepositorySql",
      `${file} adds a value to missing type ${name}`,
    );
  }
  const value = readEnumLiteral(rest, file, name);
  if (current.includes(value)) {
    return;
  }
  enums.set(name, [...current, value]);
}

function createTable(
  tables: Map<string, WorkingTable>,
  enums: Map<string, [string, ...string[]]>,
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
    const column = readColumn(part, file, name, enums);
    storeColumn(table, column, file);
  }
  tables.set(name, table);
}

function addColumn(
  tables: Map<string, WorkingTable>,
  enums: Map<string, [string, ...string[]]>,
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
  const column = readColumn(definition, file, name, enums);
  storeColumn(table, column, file);
}

function storeColumn(table: WorkingTable, column: WorkingColumn, file: string) {
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

function finishTable(
  table: WorkingTable,
  enums: Map<string, [string, ...string[]]>,
): TableSchema {
  for (const [name, type] of Object.entries(reservedTypes)) {
    const column = table.reserved.get(name);
    if (!column || column.nullable || column.type !== type) {
      throw projectError(
        "invalidRepositorySql",
        `${table.name}.${name} must be ${type} not null`,
      );
    }
  }
  return {
    name: table.name,
    columns: table.columns.map((column) => finishColumn(column, enums)),
  };
}

function finishColumn(
  column: WorkingColumn,
  enums: Map<string, [string, ...string[]]>,
): DomainColumn {
  if (column.type !== "enum") {
    return column;
  }
  const values = enums.get(column.enumName);
  if (!values) {
    throw projectError(
      "invalidRepositorySql",
      `${column.name} references missing type ${column.enumName}`,
    );
  }
  return {
    name: column.name,
    type: "enum",
    nullable: column.nullable,
    values,
  };
}

function readColumn(
  definition: string,
  file: string,
  table: string,
  enums: Map<string, [string, ...string[]]>,
): WorkingColumn {
  const ident = readIdent(definition.trim());
  if (!ident) {
    throw projectError(
      "invalidRepositorySql",
      `${file} has a column in ${table} Keja cannot read`,
    );
  }
  const mapped = typePatterns.find((item) => item.pattern.test(ident.rest));
  const nullable = !/\b(?:not\s+null|primary\s+key)\b/i.test(ident.rest);
  if (mapped) {
    return { name: ident.name, type: mapped.type, nullable };
  }
  const enumName = readTypeReference(ident.rest);
  if (enumName && enums.has(enumName)) {
    return { name: ident.name, type: "enum", nullable, enumName };
  }
  throw projectError(
    "invalidRepositorySql",
    `${file} column ${table}.${ident.name} has no TypeScript type`,
  );
}

function readTypeReference(rest: string) {
  const parts: string[] = [];
  let remaining = rest.trim();
  while (remaining !== "") {
    const ident = readIdent(remaining);
    if (!ident) {
      break;
    }
    parts.push(ident.name);
    remaining = ident.rest;
    if (!remaining.startsWith(".")) {
      break;
    }
    remaining = remaining.slice(1).trim();
  }
  return parts.at(-1);
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

function typeName(token: string, file: string) {
  const name = readTypeReference(token);
  if (!name || !/^[a-z_][a-z0-9_]*$/.test(name)) {
    throw projectError(
      "invalidRepositorySql",
      `${file} has a type name Keja cannot read`,
    );
  }
  return name;
}

function readEnumValues(body: string, file: string, type: string) {
  const values: string[] = [];
  for (const part of splitTopLevel(body)) {
    if (part.trim() === "") {
      continue;
    }
    values.push(readEnumLiteral(part.trim(), file, type));
  }
  if (values.length === 0) {
    throw projectError(
      "invalidRepositorySql",
      `${file} type ${type} has no enum values`,
    );
  }
  return values as [string, ...string[]];
}

function readEnumLiteral(value: string, file: string, type: string) {
  const match = value.match(/^'((?:[^']|'')*)'(?:\s+.*)?$/s);
  if (!match?.[1]) {
    throw projectError(
      "invalidRepositorySql",
      `${file} type ${type} has an enum value Keja cannot read`,
    );
  }
  return match[1].replaceAll("''", "'");
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
