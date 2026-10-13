export type FieldType =
  | "text" | "longtext" | "email" | "phone" | "url" | "number" | "currency"
  | "date" | "datetime" | "select" | "status" | "rating" | "boolean" | "tags";

export interface Field {
  key: string;
  label: string;
  type: FieldType;
  options?: string[];
  default?: string;
  hidden?: boolean;
}

export interface Action {
  id: string;
  label: string;
  /** Tool categories this action can use; first one configured wins. Empty = local only. */
  slots: string[];
  scope: "row" | "table";
  core?: boolean;
}

export interface Entity {
  key: string;
  label: string;
  plural: string;
  icon: string;
  titleField: string;
  boardField?: string;
  fields: Field[];
  actions: Action[];
}

export interface Stat {
  label: string;
  entity: string;
  agg: "count" | "sum" | "avg";
  field?: string;
  where?: { field: string; in?: string[]; notIn?: string[] };
  format: "number" | "currency" | "decimal";
}

export interface Module {
  id: string;
  label: string;
  description: string;
  icon: string;
  entities: Entity[];
  stats: Stat[];
}

export interface Blueprint {
  version: 1;
  name: string;
  slug: string;
  description: string;
  vertical: string;
  theme: { accent: string };
  currency: string;
  dataLayer: "local" | "supabase" | "firebase" | "api";
  modules: Module[];
  tools: string[];
  primaryTools: Record<string, string>;
}

export type Row = { id: string } & Record<string, any>;
