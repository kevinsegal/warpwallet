"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useWallet } from "@/lib/client/wallet";
import { Copyable } from "@/components/Copyable";
import {
  ACTION_PALETTE,
  CONDITION_PALETTE,
  TEMPLATES,
  TRIGGER_PALETTE,
  templateById,
} from "@/lib/warpscript/blocks";
import { compileContract } from "@/lib/warpscript/compile";
import type {
  Action,
  Clause,
  Condition,
  ContractSpec,
  Param,
  ParamType,
  WarpNetwork,
} from "@/lib/warpscript/types";

const PARAM_TYPES: ParamType[] = [
  "address", "tag", "amount", "duration", "number", "text", "date", "boolean",
];
const NETWORKS: WarpNetwork[] = ["earth", "luna", "mars", "interplanetary"];

function blankSpec(author: string): ContractSpec {
  return {
    schema: "warpscript/v1",
    name: "Untitled Contract",
    description: "",
    author,
    network: "earth",
    params: [],
    clauses: [],
    createdAt: Date.now(),
  };
}

export default function ContractsPage() {
  const w = useWallet();
  const [spec, setSpec] = useState<ContractSpec | null>(null);

  const author = w.address ?? "";

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <span className="chip w-fit">🧩 WarpScript studio</span>
        <h1 className="text-3xl font-bold">No-code smart contracts</h1>
        <p className="max-w-2xl text-[var(--muted)]">
          Compose agreements from visual blocks — no Solidity, no CLI. The studio
          compiles your design into deterministic, content-addressed WarpScript
          and a deployable artifact for the forthcoming WarpVM.
        </p>
      </header>

      {!spec ? (
        <Gallery
          onPick={(id) => setSpec(id ? templateById(id)!.build(author) : blankSpec(author))}
        />
      ) : (
        <Builder
          spec={{ ...spec, author }}
          setSpec={setSpec}
          onBack={() => setSpec(null)}
        />
      )}

      <Deployed author={author} />
    </div>
  );
}

function Gallery({ onPick }: { onPick: (id: string | null) => void }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-sm uppercase tracking-wide text-[var(--muted)]">Start from a template</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TEMPLATES.map((t) => (
          <button
            key={t.id}
            onClick={() => onPick(t.id)}
            className="panel flex flex-col gap-2 p-5 text-left transition hover:border-[var(--warp-2)]"
          >
            <span className="chip w-fit">{t.category}</span>
            <h3 className="font-semibold">{t.name}</h3>
            <p className="text-sm text-[var(--muted)]">{t.description}</p>
          </button>
        ))}
        <button
          onClick={() => onPick(null)}
          className="panel flex flex-col items-center justify-center gap-2 border-dashed p-5 text-center text-[var(--muted)] transition hover:border-[var(--warp-2)]"
        >
          <span className="text-2xl">＋</span>
          Start from scratch
        </button>
      </div>
    </section>
  );
}

function Builder({
  spec,
  setSpec,
  onBack,
}: {
  spec: ContractSpec;
  setSpec: (s: ContractSpec) => void;
  onBack: () => void;
}) {
  const compiled = useMemo(() => compileContract(spec), [spec]);
  const [deploy, setDeploy] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const update = (patch: Partial<ContractSpec>) => setSpec({ ...spec, ...patch });

  function addParam() {
    update({
      params: [
        ...spec.params,
        { key: `param${spec.params.length + 1}`, label: "New parameter", type: "text", value: "" },
      ],
    });
  }
  function setParam(i: number, p: Partial<Param>) {
    const params = spec.params.slice();
    params[i] = { ...params[i], ...p };
    update({ params });
  }
  function removeParam(i: number) {
    update({ params: spec.params.filter((_, j) => j !== i) });
  }

  function addClause() {
    const clause: Clause = {
      id: `clause${spec.clauses.length + 1}`,
      name: `Clause ${spec.clauses.length + 1}`,
      trigger: { type: "manual" },
      conditions: [{ type: "always" }],
      actions: [{ type: "transfer", to: "", amount: "amount" }],
    };
    update({ clauses: [...spec.clauses, clause] });
  }
  function setClause(i: number, c: Clause) {
    const clauses = spec.clauses.slice();
    clauses[i] = c;
    update({ clauses });
  }
  function removeClause(i: number) {
    update({ clauses: spec.clauses.filter((_, j) => j !== i) });
  }

  async function doDeploy() {
    setDeploy(null);
    setBusy(true);
    try {
      const res = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spec }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Deploy failed.");
      setDeploy({ kind: "ok", msg: `Deployed at ${data.contract.contractAddress}` });
    } catch (e) {
      setDeploy({ kind: "err", msg: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Editor */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <button className="btn btn-ghost py-1" onClick={onBack}>← Templates</button>
          <span className="text-xs text-[var(--muted)]">author: {spec.author || "connect wallet"}</span>
        </div>

        <section className="panel flex flex-col gap-3 p-5">
          <div>
            <label className="label">Contract name</label>
            <input className="input" value={spec.name} onChange={(e) => update({ name: e.target.value })} />
          </div>
          <div>
            <label className="label">Description</label>
            <input className="input" value={spec.description} onChange={(e) => update({ description: e.target.value })} />
          </div>
          <div>
            <label className="label">Network</label>
            <select className="input" value={spec.network} onChange={(e) => update({ network: e.target.value as WarpNetwork })}>
              {NETWORKS.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </section>

        <section className="panel flex flex-col gap-3 p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm uppercase tracking-wide text-[var(--muted)]">Parameters</h3>
            <button className="btn btn-ghost py-1" onClick={addParam}>＋ Add</button>
          </div>
          {spec.params.map((p, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 rounded-lg border border-[var(--panel-border)] p-2">
              <input className="input" placeholder="label" value={p.label} onChange={(e) => setParam(i, { label: e.target.value })} />
              <input className="input mono" placeholder="key" value={p.key} onChange={(e) => setParam(i, { key: e.target.value })} />
              <button className="btn btn-danger py-1 px-2" onClick={() => removeParam(i)}>✕</button>
              <select className="input" value={p.type} onChange={(e) => setParam(i, { type: e.target.value as ParamType })}>
                {PARAM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <input className="input" placeholder="default value" value={p.value} onChange={(e) => setParam(i, { value: e.target.value })} />
              <label className="flex items-center justify-center gap-1 text-xs text-[var(--muted)]">
                <input type="checkbox" checked={!!p.required} onChange={(e) => setParam(i, { required: e.target.checked })} /> req
              </label>
            </div>
          ))}
          {spec.params.length === 0 && <p className="text-sm text-[var(--muted)]">No parameters yet.</p>}
        </section>

        <section className="panel flex flex-col gap-3 p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm uppercase tracking-wide text-[var(--muted)]">Clauses</h3>
            <button className="btn btn-ghost py-1" onClick={addClause}>＋ Add</button>
          </div>
          {spec.clauses.map((c, i) => (
            <ClauseEditor key={i} clause={c} onChange={(nc) => setClause(i, nc)} onRemove={() => removeClause(i)} />
          ))}
          {spec.clauses.length === 0 && <p className="text-sm text-[var(--muted)]">No clauses yet — add one to make the contract do something.</p>}
        </section>
      </div>

      {/* Preview */}
      <div className="flex flex-col gap-4 lg:sticky lg:top-20 lg:self-start">
        <section className="panel flex flex-col gap-3 p-5">
          <h3 className="text-sm uppercase tracking-wide text-[var(--muted)]">Compiled WarpScript</h3>
          <pre className="mono max-h-72 overflow-auto whitespace-pre rounded-lg bg-black/40 p-3 text-xs leading-relaxed text-[var(--warp)]">{compiled.warpscript}</pre>
          <div>
            <div className="label">Contract address (deterministic)</div>
            <Copyable text={compiled.contractAddress} className="w-full" />
          </div>
          <div className="mono text-xs text-[var(--muted)]">id: {compiled.contractId.slice(0, 24)}…</div>
          {compiled.warnings.length > 0 && (
            <ul className="flex flex-col gap-1 rounded-lg border border-[var(--danger)] p-3 text-xs" style={{ color: "var(--danger)" }}>
              {compiled.warnings.map((wn, i) => <li key={i}>⚠ {wn}</li>)}
            </ul>
          )}
          {deploy && (
            <div className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: deploy.kind === "ok" ? "var(--ok)" : "var(--danger)", color: deploy.kind === "ok" ? "var(--ok)" : "var(--danger)" }}>
              {deploy.msg}
            </div>
          )}
          <button className="btn btn-primary" onClick={doDeploy} disabled={busy || spec.clauses.length === 0}>
            {busy ? "Deploying…" : "Deploy contract"}
          </button>
          <p className="text-xs text-[var(--muted)]">
            Deploying registers the content-addressed artifact. On-chain execution
            lands with WarpVM; today the artifact is verifiable and immutable.
          </p>
        </section>
      </div>
    </div>
  );
}

function ClauseEditor({
  clause,
  onChange,
  onRemove,
}: {
  clause: Clause;
  onChange: (c: Clause) => void;
  onRemove: () => void;
}) {
  const set = (patch: Partial<Clause>) => onChange({ ...clause, ...patch });

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-[var(--panel-border)] bg-white/[0.02] p-3">
      <div className="flex items-center gap-2">
        <input className="input" value={clause.name} onChange={(e) => set({ name: e.target.value })} />
        <button className="btn btn-danger py-1 px-2" onClick={onRemove}>✕</button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label">When (trigger)</label>
          <select className="input" value={clause.trigger.type} onChange={(e) => set({ trigger: { ...clause.trigger, type: e.target.value as Clause["trigger"]["type"] } })}>
            {TRIGGER_PALETTE.map((t) => <option key={t.type} value={t.type}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Trigger ref</label>
          <input className="input mono" placeholder="param key" value={clause.trigger.ref ?? ""} onChange={(e) => set({ trigger: { ...clause.trigger, ref: e.target.value } })} />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="label mb-0">Conditions</span>
          <button className="text-xs text-[var(--warp)]" onClick={() => set({ conditions: [...clause.conditions, { type: "always" }] })}>＋ condition</button>
        </div>
        {clause.conditions.map((cond, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2">
            <select className="input" value={cond.type} onChange={(e) => {
              const conditions = clause.conditions.slice();
              conditions[i] = { ...cond, type: e.target.value as Condition["type"] };
              set({ conditions });
            }}>
              {CONDITION_PALETTE.map((c) => <option key={c.type} value={c.type}>{c.label}</option>)}
            </select>
            <input className="input mono" placeholder="ref / value" value={cond.ref ?? cond.value ?? ""} onChange={(e) => {
              const conditions = clause.conditions.slice();
              conditions[i] = { ...cond, ref: e.target.value, value: e.target.value };
              set({ conditions });
            }} />
            <button className="btn btn-danger py-1 px-2" onClick={() => set({ conditions: clause.conditions.filter((_, j) => j !== i) })}>✕</button>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="label mb-0">Actions</span>
          <button className="text-xs text-[var(--warp)]" onClick={() => set({ actions: [...clause.actions, { type: "transfer", to: "", amount: "amount" }] })}>＋ action</button>
        </div>
        {clause.actions.map((a, i) => {
          const setAction = (patch: Partial<Action>) => {
            const actions = clause.actions.slice();
            actions[i] = { ...a, ...patch };
            set({ actions });
          };
          return (
            <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2">
              <select className="input" value={a.type} onChange={(e) => setAction({ type: e.target.value as Action["type"] })}>
                {ACTION_PALETTE.map((ac) => <option key={ac.type} value={ac.type}>{ac.label}</option>)}
              </select>
              <input className="input mono" placeholder={a.type === "notify" ? "note" : "to (param)"} value={a.type === "notify" ? a.note ?? "" : a.to ?? ""} onChange={(e) => setAction(a.type === "notify" ? { note: e.target.value } : { to: e.target.value })} />
              <input className="input mono" placeholder={a.type === "split" ? "a:60,b:40" : "amount"} value={a.type === "split" ? a.splits ?? "" : a.amount ?? ""} onChange={(e) => setAction(a.type === "split" ? { splits: e.target.value } : { amount: e.target.value })} />
              <button className="btn btn-danger py-1 px-2" onClick={() => set({ actions: clause.actions.filter((_, j) => j !== i) })}>✕</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Deployed({ author }: { author: string }) {
  const [contracts, setContracts] = useState<
    { contractId: string; contractAddress: string; name: string; network: string; deployedAt: number }[]
  >([]);

  const load = useCallback(async () => {
    const res = await fetch(`/api/contracts?author=${author}`, { cache: "no-store" });
    if (res.ok) setContracts((await res.json()).contracts ?? []);
  }, [author]);

  useEffect(() => { void load(); }, [load]);

  if (contracts.length === 0) return null;

  return (
    <section className="panel flex flex-col gap-3 p-6">
      <h2 className="text-sm uppercase tracking-wide text-[var(--muted)]">Deployed contracts</h2>
      <ul className="flex flex-col divide-y divide-[var(--panel-border)]">
        {contracts.map((c) => (
          <li key={c.contractId} className="flex items-center justify-between gap-4 py-3">
            <div className="min-w-0">
              <div className="font-semibold">{c.name}</div>
              <div className="mono truncate text-xs text-[var(--muted)]">{c.contractAddress}</div>
            </div>
            <span className="chip">{c.network}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
