import type { SQLInputValue, SQLOutputValue } from 'node:sqlite';

/** A row as node:sqlite returns it. */
export type Row = Record<string, SQLOutputValue>;

/** A column read off a row; `undefined` only if the column name is wrong. */
type Cell = SQLOutputValue | undefined;

/** Reads a nullable text column; SQL NULL becomes an absent optional field. */
export const optText = (v: Cell): string | undefined => (v == null ? undefined : String(v));

/** Reads a nullable integer column. */
export const optNum = (v: Cell): number | undefined => (v == null ? undefined : Number(v));

/** Writes an optional field; undefined becomes SQL NULL. */
export const nullable = (v: string | number | undefined): SQLInputValue => v ?? null;

/**
 * Parses a JSON column we wrote ourselves. Typed by the caller because this
 * column only ever holds what the matching repository serialised.
 */
export const json = <T>(v: Cell): T => JSON.parse(String(v)) as T;
