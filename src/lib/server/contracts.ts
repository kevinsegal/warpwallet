/** Deployed-contract registry for the no-code WarpScript studio. */
import { compileContract } from "../warpscript/compile";
import type { ContractSpec } from "../warpscript/types";
import { getStore } from "./store";

export interface DeployedContract {
  contractId: string;
  contractAddress: string;
  name: string;
  network: string;
  author: string;
  warpscript: string;
  bytecode: object;
  spec: ContractSpec;
  deployedAt: number;
  status: "deployed";
}

const key = (id: string) => `contract:${id}`;

export async function deployContract(
  spec: ContractSpec,
): Promise<{ ok: boolean; error?: string; contract?: DeployedContract; warnings?: string[] }> {
  const compiled = compileContract(spec);
  // Block deployment only on structural emptiness; surface other lint as warnings.
  if (spec.clauses.length === 0)
    return { ok: false, error: "contract has no clauses", warnings: compiled.warnings };

  const contract: DeployedContract = {
    contractId: compiled.contractId,
    contractAddress: compiled.contractAddress,
    name: spec.name || "Untitled Contract",
    network: spec.network,
    author: spec.author,
    warpscript: compiled.warpscript,
    bytecode: compiled.bytecode,
    spec,
    deployedAt: Date.now(),
    status: "deployed",
  };
  await getStore().set(key(contract.contractId), contract);
  return { ok: true, contract, warnings: compiled.warnings };
}

export async function getContract(id: string): Promise<DeployedContract | null> {
  return getStore().get<DeployedContract>(key(id));
}

export async function listContractsBy(author: string): Promise<DeployedContract[]> {
  const all = await getStore().list<DeployedContract>("contract:");
  return all
    .filter((c) => !author || c.author === author)
    .sort((a, b) => b.deployedAt - a.deployedAt);
}
