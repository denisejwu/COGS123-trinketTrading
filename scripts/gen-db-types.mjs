/**
 * Generates src/lib/database.types.ts from the migration files, without
 * needing a Supabase project or Docker:
 *
 *   npm run db:types:local
 *
 * It runs every migration inside PGlite (an in-memory Postgres), reads the
 * tables, enums, relationships and functions back out, and writes them in
 * the same format as `supabase gen types typescript`.
 */
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const outFile = join(root, "src", "lib", "database.types.ts");

// ---- 1. Build the database -------------------------------------------------
const db = new PGlite();
await db.exec(readFileSync(join(root, "tests", "db", "supabase-shim.sql"), "utf8"));
const migrationsDir = join(root, "supabase", "migrations");
for (const file of readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort()) {
  await db.exec(readFileSync(join(migrationsDir, file), "utf8"));
}

// ---- 2. Read the schema back out -------------------------------------------
const { rows: columns } = await db.query(`
  select c.relname as table, c.relkind as kind, a.attname as column,
         t.typname, t.typtype, t.typcategory,
         et.typname as elem_typname, et.typtype as elem_typtype,
         not a.attnotnull as nullable,
         (a.atthasdef or a.attidentity <> '' or a.attgenerated <> '') as has_default
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  join pg_type t on t.oid = a.atttypid
  left join pg_type et on et.oid = t.typelem and t.typcategory = 'A'
  where n.nspname = 'public' and c.relkind in ('r', 'p', 'v') and a.attnum > 0 and not a.attisdropped
  order by c.relname, a.attname`);

const { rows: enumRows } = await db.query(`
  select t.typname, e.enumlabel
  from pg_type t
  join pg_enum e on e.enumtypid = t.oid
  join pg_namespace n on n.oid = t.typnamespace
  where n.nspname = 'public'
  order by t.typname, e.enumsortorder`);

const { rows: fkRows } = await db.query(`
  select con.conname, src.relname as table, tgt.relname as ref_table,
    array(select a.attname from unnest(con.conkey) with ordinality k(n, ord)
          join pg_attribute a on a.attrelid = con.conrelid and a.attnum = k.n order by k.ord) as columns,
    array(select a.attname from unnest(con.confkey) with ordinality k(n, ord)
          join pg_attribute a on a.attrelid = con.confrelid and a.attnum = k.n order by k.ord) as ref_columns,
    exists (
      select 1 from pg_index i
      where i.indrelid = con.conrelid and i.indisunique
        and (select array_agg(x order by x) from unnest(i.indkey::int2[]) x)
          = (select array_agg(x order by x) from unnest(con.conkey) x)
    ) as one_to_one
  from pg_constraint con
  join pg_class src on src.oid = con.conrelid
  join pg_class tgt on tgt.oid = con.confrelid
  join pg_namespace sn on sn.oid = src.relnamespace
  join pg_namespace tn on tn.oid = tgt.relnamespace
  where con.contype = 'f' and sn.nspname = 'public' and tn.nspname = 'public'
  order by src.relname, con.conname`);

const { rows: fnRows } = await db.query(`
  select p.oid, p.proname, p.pronargs, p.pronargdefaults, p.proretset,
         rt.typname as ret_typname, rt.typtype as ret_typtype, rt.typcategory as ret_category,
         ret_elem.typname as ret_elem_typname, ret_elem.typtype as ret_elem_typtype,
         rel.relname as ret_table
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  join pg_type rt on rt.oid = p.prorettype
  left join pg_type ret_elem on ret_elem.oid = rt.typelem and rt.typcategory = 'A'
  left join pg_class rel on rel.oid = rt.typrelid
  where n.nspname = 'public' and p.prokind = 'f' and rt.typname <> 'trigger'
  order by p.proname`);

const { rows: argRows } = await db.query(`
  select p.oid, a.ord, a.name, t.typname, t.typtype, t.typcategory,
         et.typname as elem_typname, et.typtype as elem_typtype
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  cross join lateral unnest(p.proargtypes::oid[], p.proargnames) with ordinality as a(typ, name, ord)
  join pg_type t on t.oid = a.typ
  left join pg_type et on et.oid = t.typelem and t.typcategory = 'A'
  where n.nspname = 'public' and a.typ is not null
  order by p.oid, a.ord`);

// ---- 3. Postgres type -> TypeScript type ------------------------------------
function tsType(typname, typtype, elemTypname, elemTyptype) {
  if (elemTypname) return `${tsType(elemTypname, elemTyptype)}[]`;
  if (typtype === "e") return `Database["public"]["Enums"]["${typname}"]`;
  if (typname === "bool") return "boolean";
  if (["int2", "int4", "int8", "float4", "float8", "numeric"].includes(typname)) return "number";
  if (["json", "jsonb"].includes(typname)) return "Json";
  if (typname === "void") return "undefined";
  return "string"; // text, uuid, timestamps, dates, ...
}

const pad = (n) => " ".repeat(n);
const lines = [];
const out = (indent, text) => lines.push(pad(indent) + text);

// ---- 4. Write the file --------------------------------------------------------
out(0, "// AUTO-GENERATED by `npm run db:types:local` (or `npm run db:types`). Do not edit by hand.");
out(0, "// It describes the database so Supabase queries get autocomplete and type checks.");
out(0, "");
out(0, "export type Json =");
out(2, "| string");
out(2, "| number");
out(2, "| boolean");
out(2, "| null");
out(2, "| { [key: string]: Json | undefined }");
out(2, "| Json[];");
out(0, "");
out(0, "export type Database = {");
out(2, "public: {");

function writeRelations(table) {
  const fks = fkRows.filter((fk) => fk.table === table);
  if (fks.length === 0) return out(8, "Relationships: [];");
  out(8, "Relationships: [");
  for (const fk of fks) {
    out(10, "{");
    out(12, `foreignKeyName: "${fk.conname}";`);
    out(12, `columns: [${fk.columns.map((c) => `"${c}"`).join(", ")}];`);
    out(12, `isOneToOne: ${fk.one_to_one};`);
    out(12, `referencedRelation: "${fk.ref_table}";`);
    out(12, `referencedColumns: [${fk.ref_columns.map((c) => `"${c}"`).join(", ")}];`);
    out(10, "},");
  }
  out(8, "];");
}

for (const kind of ["Tables", "Views"]) {
  const relkinds = kind === "Tables" ? ["r", "p"] : ["v"];
  const tables = [...new Set(columns.filter((c) => relkinds.includes(c.kind)).map((c) => c.table))];
  out(4, `${kind}: {`);
  if (tables.length === 0) out(6, "[_ in never]: never;");
  for (const table of tables) {
    const cols = columns.filter((c) => c.table === table);
    out(6, `${table}: {`);
    const sections = kind === "Tables" ? ["Row", "Insert", "Update"] : ["Row"];
    for (const section of sections) {
      out(8, `${section}: {`);
      for (const c of cols) {
        const base = tsType(c.typname, c.typtype, c.elem_typname, c.elem_typtype);
        const type = c.nullable ? `${base} | null` : base;
        const optional = section === "Update" || (section === "Insert" && (c.nullable || c.has_default));
        out(10, `${c.column}${optional ? "?" : ""}: ${type};`);
      }
      out(8, "};");
    }
    writeRelations(table);
    out(6, "};");
  }
  out(4, "};");
}

out(4, "Functions: {");
if (fnRows.length === 0) out(6, "[_ in never]: never;");
for (const fn of fnRows) {
  const args = argRows.filter((a) => a.oid === fn.oid);
  const firstOptional = fn.pronargs - fn.pronargdefaults; // the last N args have defaults
  let returns = fn.ret_table
    ? `Database["public"]["Tables"]["${fn.ret_table}"]["Row"]`
    : tsType(fn.ret_typname, fn.ret_typtype, fn.ret_elem_typname, fn.ret_elem_typtype);
  if (fn.proretset) returns += "[]";
  out(6, `${fn.proname}: {`);
  if (args.length === 0) out(8, "Args: never;");
  else {
    out(8, "Args: {");
    args.forEach((a, i) => {
      const type = tsType(a.typname, a.typtype, a.elem_typname, a.elem_typtype);
      out(10, `${a.name}${i >= firstOptional ? "?" : ""}: ${type};`);
    });
    out(8, "};");
  }
  out(8, `Returns: ${returns};`);
  out(6, "};");
}
out(4, "};");

out(4, "Enums: {");
const enums = [...new Set(enumRows.map((e) => e.typname))];
if (enums.length === 0) out(6, "[_ in never]: never;");
for (const name of enums) {
  const labels = enumRows.filter((e) => e.typname === name).map((e) => `"${e.enumlabel}"`);
  out(6, `${name}: ${labels.join(" | ")};`);
}
out(4, "};");
out(4, "CompositeTypes: {");
out(6, "[_ in never]: never;");
out(4, "};");
out(2, "};");
out(0, "};");
out(0, "");
out(0, 'type PublicSchema = Database["public"];');
out(0, 'export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"];');
out(0, 'export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"];');
out(0, 'export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"];');
out(0, 'export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T];');
out(0, "");

writeFileSync(outFile, lines.join("\n"));
console.log(`Wrote ${outFile}`);
await db.close();
