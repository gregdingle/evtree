import { fromPairs } from "es-toolkit/compat";

export interface Variable {
  name: string;
  value: number;
  scope: "value" | "cost" | "probability";
}

export function variablesToRecord(
  variables: Variable[] | undefined,
  scope: Variable["scope"],
): Record<string, number> {
  if (!variables) return {};
  return fromPairs(
    variables.filter((v) => v.scope === scope).map((v) => [v.name, v.value]),
  );
}
