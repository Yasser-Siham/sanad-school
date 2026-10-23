declare module 'node:sqlite' {
  export type SQLInputValue = string | number | bigint | null | Uint8Array;
  export interface StatementResult { changes: number; lastInsertRowid: number | bigint }
  export interface StatementSync {
    run(...values: SQLInputValue[]): StatementResult;
    get(...values: SQLInputValue[]): Record<string, unknown> | undefined;
    all(...values: SQLInputValue[]): Array<Record<string, unknown>>;
  }
  export class DatabaseSync {
    constructor(path: string);
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
  }
}
