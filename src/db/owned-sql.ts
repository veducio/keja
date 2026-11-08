export const ownedObjectSql = `
create or replace function keja_is_object_id(value text)
returns boolean
language sql
immutable
as $$
  select value ~ '^[a-z][a-z0-9]*_[0-9A-Za-z]{21}$'
$$;

create or replace function keja_is_object_type(value text)
returns boolean
language sql
immutable
as $$
  select value ~ '^v[0-9]+(\\.[a-z][a-z0-9]*)+$'
$$;

create or replace function keja_is_tenant(value text)
returns boolean
language sql
immutable
as $$
  select value is not null and length(btrim(value)) > 0
$$;

create or replace function keja_owned_object_violations()
returns table(table_name text, detail text)
language plpgsql
stable
as $keja$
declare
  rel record;
  id_type text;
  object_type text;
  tenant_type text;
  archived_type text;
  id_required boolean;
  object_required boolean;
  tenant_required boolean;
  archived_required boolean;
  primary_key text;
  checks text;
begin
  for rel in
    select c.oid, c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and c.relname <> 'keja_migrations'
  loop
    select t.typname, a.attnotnull
      into id_type, id_required
    from pg_attribute a
    join pg_type t on t.oid = a.atttypid
    where a.attrelid = rel.oid
      and a.attname = '_id'
      and a.attnum > 0
      and not a.attisdropped;

    select t.typname, a.attnotnull
      into object_type, object_required
    from pg_attribute a
    join pg_type t on t.oid = a.atttypid
    where a.attrelid = rel.oid
      and a.attname = '_object'
      and a.attnum > 0
      and not a.attisdropped;

    select t.typname, a.attnotnull
      into tenant_type, tenant_required
    from pg_attribute a
    join pg_type t on t.oid = a.atttypid
    where a.attrelid = rel.oid
      and a.attname = '_tenant'
      and a.attnum > 0
      and not a.attisdropped;

    select t.typname, a.attnotnull
      into archived_type, archived_required
    from pg_attribute a
    join pg_type t on t.oid = a.atttypid
    where a.attrelid = rel.oid
      and a.attname = '_archived'
      and a.attnum > 0
      and not a.attisdropped;

    select string_agg(a.attname, ',' order by array_position(i.indkey, a.attnum))
      into primary_key
    from pg_index i
    join pg_attribute a
      on a.attrelid = i.indrelid
     and a.attnum = any(i.indkey)
    where i.indrelid = rel.oid
      and i.indisprimary;

    select string_agg(pg_get_constraintdef(pg_constraint.oid), ' ')
      into checks
    from pg_constraint
    where conrelid = rel.oid
      and contype = 'c';

    table_name := rel.relname;
    if id_type is null then
      detail := 'missing _id';
      return next;
    elsif id_type <> 'text' or id_required is not true or primary_key is distinct from '_id' then
      detail := '_id must be a text primary key';
      return next;
    elsif checks is null or checks !~* 'keja_is_object_id[[:space:]]*\\([[:space:]]*"?_id"?' then
      detail := '_id must be checked with keja_is_object_id';
      return next;
    elsif object_type is null then
      detail := 'missing _object';
      return next;
    elsif object_type <> 'text' or object_required is not true then
      detail := '_object must be text not null';
      return next;
    elsif checks !~* 'keja_is_object_type[[:space:]]*\\([[:space:]]*"?_object"?' then
      detail := '_object must be checked with keja_is_object_type';
      return next;
    elsif tenant_type is null then
      detail := 'missing _tenant';
      return next;
    elsif tenant_type <> 'text' or tenant_required is not true then
      detail := '_tenant must be text not null';
      return next;
    elsif checks !~* 'keja_is_tenant[[:space:]]*\\([[:space:]]*"?_tenant"?' then
      detail := '_tenant must be checked with keja_is_tenant';
      return next;
    elsif archived_type is null then
      detail := 'missing _archived';
      return next;
    elsif archived_type <> 'bool' or archived_required is not true then
      detail := '_archived must be boolean not null';
      return next;
    end if;
  end loop;
end;
$keja$;
`;

export function ownedObjectViolations(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") {
      return [];
    }
    const row = item as { table_name?: unknown; detail?: unknown };
    if (typeof row.table_name !== "string" || typeof row.detail !== "string") {
      return [];
    }
    return [`${row.table_name} ${row.detail}`];
  });
}
