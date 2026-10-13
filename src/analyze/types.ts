import type { FieldType } from "../blueprint/schema.js";

export interface CsvColumn {
  name: string;
  type: FieldType;
  /** Distinct values, only for low-cardinality columns (statuses, categories). Omitted with --no-values. */
  values?: string[];
  filledRatio: number;
}

export interface CsvEvidence {
  kind: "csv";
  file: string;
  rowCount: number;
  columns: CsvColumn[];
}

export interface HarEndpoint {
  method: string;
  path: string;
  status: number;
  /** Key -> JSON type of the first object in the response; values are never recorded. */
  shape?: Record<string, string>;
  isList?: boolean;
}

export interface HarEvidence {
  kind: "har";
  file: string;
  host: string;
  endpoints: HarEndpoint[];
}

export type Evidence = CsvEvidence | HarEvidence;
