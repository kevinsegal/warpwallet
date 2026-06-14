/**
 * WarpScript — a declarative, no-code contract model. Users compose agreements
 * from typed parameters and clauses (when/then) in the GUI; the compiler turns
 * the resulting spec into a deterministic, deployable artifact. This is a
 * scaffold for the forthcoming WarpVM: the artifacts are real and content-
 * addressed today, and the same shape will execute on-chain once WarpVM ships.
 */

export type ParamType =
  | "address"
  | "tag"
  | "amount"
  | "duration"
  | "number"
  | "text"
  | "date"
  | "boolean";

export interface Param {
  key: string;
  label: string;
  type: ParamType;
  /** Default / configured value (as entered in the GUI). */
  value: string;
  required?: boolean;
}

export type TriggerType =
  | "manual"
  | "on_fund"
  | "on_approval"
  | "on_deadline"
  | "on_oracle"
  | "on_light_time";

export interface Trigger {
  type: TriggerType;
  /** Free-form reference, e.g. a param key (approver), oracle name, body id. */
  ref?: string;
}

export type ConditionType =
  | "signed_by"
  | "amount_at_least"
  | "before"
  | "after"
  | "all_approved"
  | "any_approved"
  | "light_time_elapsed"
  | "always";

export interface Condition {
  type: ConditionType;
  ref?: string; // param key or list of param keys (comma separated)
  value?: string;
}

export type ActionType =
  | "transfer"
  | "split"
  | "refund"
  | "lock"
  | "release"
  | "notify";

export interface Action {
  type: ActionType;
  to?: string; // param key (address/tag)
  amount?: string; // param key or literal
  /** For split: "buyerKey:60,sellerKey:40" style weights. */
  splits?: string;
  note?: string;
}

export interface Clause {
  id: string;
  name: string;
  trigger: Trigger;
  conditions: Condition[];
  actions: Action[];
}

export type WarpNetwork = "earth" | "luna" | "mars" | "interplanetary";

export interface ContractSpec {
  schema: "warpscript/v1";
  name: string;
  description: string;
  author: string; // W-address of the creator
  network: WarpNetwork;
  params: Param[];
  clauses: Clause[];
  createdAt: number;
}

export interface CompiledContract {
  /** Content hash of the canonical spec (hex sha256d). */
  contractId: string;
  /** Deterministic W-address derived from the spec hash. */
  contractAddress: string;
  /** Human-readable WarpScript source rendering of the spec. */
  warpscript: string;
  /** Machine artifact the future WarpVM will load. */
  bytecode: object;
  /** Static-analysis findings; empty means clean. */
  warnings: string[];
  spec: ContractSpec;
}
