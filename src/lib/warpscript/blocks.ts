/** Palette + starter templates for the no-code contract studio. */
import type {
  ActionType,
  ConditionType,
  ContractSpec,
  TriggerType,
} from "./types";

export const TRIGGER_PALETTE: { type: TriggerType; label: string; hint: string }[] = [
  { type: "manual", label: "Manual call", hint: "A party invokes the clause" },
  { type: "on_fund", label: "On funding", hint: "Contract receives WARP" },
  { type: "on_approval", label: "On approval", hint: "A party approves" },
  { type: "on_deadline", label: "On deadline", hint: "A date/time is reached" },
  { type: "on_oracle", label: "On oracle event", hint: "External data feed fires" },
  { type: "on_light_time", label: "On light-time", hint: "Interplanetary delay elapses" },
];

export const CONDITION_PALETTE: { type: ConditionType; label: string; hint: string }[] = [
  { type: "always", label: "Always", hint: "No condition" },
  { type: "signed_by", label: "Signed by", hint: "Requires a party's signature" },
  { type: "all_approved", label: "All approved", hint: "Every listed party approves" },
  { type: "any_approved", label: "Any approved", hint: "Any listed party approves" },
  { type: "amount_at_least", label: "Amount ≥", hint: "Minimum funded amount" },
  { type: "before", label: "Before", hint: "Earlier than a deadline" },
  { type: "after", label: "After", hint: "Later than a date" },
  { type: "light_time_elapsed", label: "Light-time elapsed", hint: "Round-trip light delay passed" },
];

export const ACTION_PALETTE: { type: ActionType; label: string; hint: string }[] = [
  { type: "transfer", label: "Transfer", hint: "Send WARP to a party" },
  { type: "release", label: "Release escrow", hint: "Release held funds" },
  { type: "refund", label: "Refund", hint: "Return funds to payer" },
  { type: "split", label: "Split", hint: "Distribute by weights" },
  { type: "lock", label: "Lock", hint: "Hold funds in the contract" },
  { type: "notify", label: "Notify", hint: "Emit an event/webhook" },
];

export interface Template {
  id: string;
  name: string;
  category: string;
  description: string;
  build: (author: string) => ContractSpec;
}

const base = (author: string): Pick<ContractSpec, "schema" | "author" | "createdAt"> => ({
  schema: "warpscript/v1",
  author,
  createdAt: Date.now(),
});

export const TEMPLATES: Template[] = [
  {
    id: "milestone-escrow",
    name: "Milestone Escrow",
    category: "Commerce",
    description:
      "Buyer funds the contract; funds release to the seller on buyer (or arbiter) approval, otherwise refund after a deadline.",
    build: (author) => ({
      ...base(author),
      name: "Milestone Escrow",
      description: "Two-party escrow with arbiter fallback.",
      network: "earth",
      params: [
        { key: "buyer", label: "Buyer", type: "address", value: "", required: true },
        { key: "seller", label: "Seller", type: "address", value: "", required: true },
        { key: "arbiter", label: "Arbiter", type: "address", value: "" },
        { key: "amount", label: "Amount (flux)", type: "amount", value: "", required: true },
        { key: "deadline", label: "Refund deadline", type: "date", value: "" },
      ],
      clauses: [
        {
          id: "release",
          name: "Release to seller",
          trigger: { type: "on_approval", ref: "buyer" },
          conditions: [{ type: "any_approved", ref: "buyer,arbiter" }],
          actions: [{ type: "release", to: "seller", amount: "amount" }],
        },
        {
          id: "refund",
          name: "Refund buyer after deadline",
          trigger: { type: "on_deadline", ref: "deadline" },
          conditions: [{ type: "after", ref: "deadline" }],
          actions: [{ type: "refund", to: "buyer", amount: "amount" }],
        },
      ],
    }),
  },
  {
    id: "timelock-vesting",
    name: "Time-Locked Vesting",
    category: "Treasury",
    description:
      "Lock WARP for a beneficiary until a release date — vesting, savings, or a trust.",
    build: (author) => ({
      ...base(author),
      name: "Time-Locked Vesting",
      description: "Funds unlock to the beneficiary after a date.",
      network: "earth",
      params: [
        { key: "beneficiary", label: "Beneficiary", type: "address", value: "", required: true },
        { key: "amount", label: "Amount (flux)", type: "amount", value: "", required: true },
        { key: "unlock", label: "Unlock date", type: "date", value: "", required: true },
      ],
      clauses: [
        {
          id: "unlock",
          name: "Unlock to beneficiary",
          trigger: { type: "on_deadline", ref: "unlock" },
          conditions: [{ type: "after", ref: "unlock" }],
          actions: [{ type: "transfer", to: "beneficiary", amount: "amount" }],
        },
      ],
    }),
  },
  {
    id: "multisig-treasury",
    name: "Multisig Treasury",
    category: "Treasury",
    description:
      "Funds move only when a quorum of signers approves — a shared business or DAO wallet.",
    build: (author) => ({
      ...base(author),
      name: "Multisig Treasury",
      description: "Quorum-controlled payout.",
      network: "earth",
      params: [
        { key: "signerA", label: "Signer A", type: "address", value: "", required: true },
        { key: "signerB", label: "Signer B", type: "address", value: "", required: true },
        { key: "signerC", label: "Signer C", type: "address", value: "" },
        { key: "payee", label: "Payee", type: "address", value: "", required: true },
        { key: "amount", label: "Amount (flux)", type: "amount", value: "", required: true },
      ],
      clauses: [
        {
          id: "payout",
          name: "Quorum payout",
          trigger: { type: "on_approval", ref: "signerA" },
          conditions: [{ type: "all_approved", ref: "signerA,signerB" }],
          actions: [{ type: "transfer", to: "payee", amount: "amount" }],
        },
      ],
    }),
  },
  {
    id: "interplanetary-transfer",
    name: "Interplanetary Delayed Transfer",
    category: "Interplanetary",
    description:
      "A transfer that only finalizes once the round-trip light delay to the destination world has elapsed — settlement that respects physics.",
    build: (author) => ({
      ...base(author),
      name: "Interplanetary Delayed Transfer",
      description: "Light-time-aware settlement between worlds.",
      network: "interplanetary",
      params: [
        { key: "recipient", label: "Recipient", type: "address", value: "", required: true },
        { key: "amount", label: "Amount (flux)", type: "amount", value: "", required: true },
        { key: "destination", label: "Destination body", type: "text", value: "mars", required: true },
      ],
      clauses: [
        {
          id: "settle",
          name: "Settle after light delay",
          trigger: { type: "on_light_time", ref: "destination" },
          conditions: [{ type: "light_time_elapsed", ref: "destination" }],
          actions: [{ type: "transfer", to: "recipient", amount: "amount" }],
        },
      ],
    }),
  },
  {
    id: "subscription",
    name: "Subscription",
    category: "Commerce",
    description:
      "Recurring merchant payment that the subscriber can cancel; pays out each period.",
    build: (author) => ({
      ...base(author),
      name: "Subscription",
      description: "Recurring period payout to a merchant.",
      network: "earth",
      params: [
        { key: "subscriber", label: "Subscriber", type: "address", value: "", required: true },
        { key: "merchant", label: "Merchant", type: "address", value: "", required: true },
        { key: "amount", label: "Per-period amount (flux)", type: "amount", value: "", required: true },
        { key: "period", label: "Period", type: "duration", value: "30d", required: true },
      ],
      clauses: [
        {
          id: "charge",
          name: "Charge period",
          trigger: { type: "on_deadline", ref: "period" },
          conditions: [{ type: "signed_by", ref: "subscriber" }],
          actions: [{ type: "transfer", to: "merchant", amount: "amount" }],
        },
      ],
    }),
  },
];

export function templateById(id: string): Template | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
