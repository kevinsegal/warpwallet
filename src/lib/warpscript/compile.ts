/** WarpScript compiler: ContractSpec → deterministic, content-addressed artifact. */
import {
  addressFromPubKey,
  base58Encode,
  sha256d,
  bytesToHex,
} from "../warp/crypto";
import type {
  Action,
  Clause,
  CompiledContract,
  Condition,
  ContractSpec,
} from "./types";

/** Stable JSON: object keys sorted recursively so the hash is reproducible. */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(value as Record<string, unknown>).sort()) {
      out[k] = canonicalize((value as Record<string, unknown>)[k]);
    }
    return out;
  }
  return value;
}

export function canonicalJSON(spec: ContractSpec): string {
  return JSON.stringify(canonicalize(spec));
}

/** Derive a W-prefixed contract address from the spec's content hash. */
function deriveContractAddress(specHash: Uint8Array): string {
  // Reuse the address scheme (version 0x49 || 20-byte hash) so contract
  // addresses are indistinguishable in form from account addresses.
  const ADDRESS_VERSION = 0x49;
  const payload = new Uint8Array(1 + 20);
  payload[0] = ADDRESS_VERSION;
  payload.set(specHash.slice(0, 20), 1);
  const checksum = sha256d(payload).slice(0, 4);
  const full = new Uint8Array(payload.length + 4);
  full.set(payload, 0);
  full.set(checksum, payload.length);
  return base58Encode(full);
}

function renderCondition(c: Condition): string {
  switch (c.type) {
    case "signed_by":
      return `signed_by(${c.ref})`;
    case "amount_at_least":
      return `amount >= ${c.value}`;
    case "before":
      return `before(${c.ref})`;
    case "after":
      return `after(${c.ref})`;
    case "all_approved":
      return `all_approved(${c.ref})`;
    case "any_approved":
      return `any_approved(${c.ref})`;
    case "light_time_elapsed":
      return `light_time_elapsed(${c.ref})`;
    case "always":
      return "always";
    default:
      return String(c.type);
  }
}

function renderAction(a: Action): string {
  switch (a.type) {
    case "transfer":
      return `transfer(${a.amount ?? "amount"} to ${a.to})`;
    case "split":
      return `split(${a.amount ?? "amount"} as ${a.splits})`;
    case "refund":
      return `refund(${a.amount ?? "amount"} to ${a.to})`;
    case "lock":
      return `lock(${a.amount ?? "amount"})`;
    case "release":
      return `release(${a.amount ?? "amount"} to ${a.to})`;
    case "notify":
      return `notify("${a.note ?? ""}")`;
    default:
      return String(a.type);
  }
}

function renderClause(clause: Clause): string {
  const conds =
    clause.conditions.length === 0
      ? "    when always"
      : clause.conditions.map((c) => `    when ${renderCondition(c)}`).join("\n");
  const trig =
    clause.trigger.type === "manual"
      ? "    on manual"
      : `    on ${clause.trigger.type}(${clause.trigger.ref ?? ""})`;
  const acts = clause.actions.map((a) => `    do ${renderAction(a)}`).join("\n");
  return [`  clause "${clause.name}" {`, trig, conds, acts, "  }"].join("\n");
}

/** Render the spec as readable WarpScript source. */
export function renderWarpScript(spec: ContractSpec): string {
  const lines: string[] = [];
  lines.push(`contract "${spec.name}" {`);
  lines.push(`  network ${spec.network}`);
  lines.push(`  author ${spec.author || "<unset>"}`);
  if (spec.description) lines.push(`  // ${spec.description}`);
  for (const p of spec.params) {
    const req = p.required ? " required" : "";
    const def = p.value ? ` = ${JSON.stringify(p.value)}` : "";
    lines.push(`  param ${p.key}: ${p.type}${def}${req}`);
  }
  lines.push("");
  for (const c of spec.clauses) lines.push(renderClause(c));
  lines.push("}");
  return lines.join("\n");
}

/** Static analysis: flag obvious mistakes before deployment. */
function lint(spec: ContractSpec): string[] {
  const warnings: string[] = [];
  const keys = new Set(spec.params.map((p) => p.key));
  if (!spec.name.trim()) warnings.push("Contract has no name.");
  if (spec.clauses.length === 0)
    warnings.push("Contract has no clauses; it cannot do anything.");
  for (const p of spec.params) {
    if (p.required && !p.value)
      warnings.push(`Required parameter "${p.key}" has no value.`);
  }
  const refExists = (ref?: string) =>
    !ref ||
    ref
      .split(",")
      .map((r) => r.trim())
      .every((r) => !r || keys.has(r) || /^\d/.test(r));
  for (const c of spec.clauses) {
    for (const cond of c.conditions) {
      if (!refExists(cond.ref))
        warnings.push(`Clause "${c.name}" references unknown param in ${cond.type}.`);
    }
    for (const a of c.actions) {
      if (a.to && !keys.has(a.to))
        warnings.push(`Clause "${c.name}" sends to unknown param "${a.to}".`);
      if (a.amount && !keys.has(a.amount) && !/^\d/.test(a.amount))
        warnings.push(`Clause "${c.name}" uses unknown amount "${a.amount}".`);
    }
    if (c.actions.length === 0)
      warnings.push(`Clause "${c.name}" has no actions.`);
  }
  return warnings;
}

export function compileContract(spec: ContractSpec): CompiledContract {
  const canon = canonicalJSON(spec);
  const hash = sha256d(new TextEncoder().encode(canon));
  const contractId = bytesToHex(hash);
  const contractAddress = deriveContractAddress(hash);
  const warpscript = renderWarpScript(spec);
  const warnings = lint(spec);

  const bytecode = {
    schema: "warpvm/0.1-preview",
    contractId,
    network: spec.network,
    params: spec.params.map((p) => ({ key: p.key, type: p.type })),
    clauses: spec.clauses.map((c) => ({
      name: c.name,
      trigger: c.trigger,
      conditions: c.conditions,
      actions: c.actions,
    })),
  };

  return {
    contractId,
    contractAddress,
    warpscript,
    bytecode,
    warnings,
    spec,
  };
}

// Re-export so callers can derive account addresses if needed.
export { addressFromPubKey };
