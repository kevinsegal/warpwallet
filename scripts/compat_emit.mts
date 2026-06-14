// Emit a TS-signed address + transaction so the Go chain code can verify them.
import { generateKeyPair, validateAddress } from "../src/lib/warp/crypto.ts";
import { buildSignedTransfer, verifyTransaction, toRPCJSON } from "../src/lib/warp/tx.ts";

const sender = generateKeyPair();
const recipient = generateKeyPair();

const tx = buildSignedTransfer({
  to: recipient.address,
  amount: 1234500000, // flux
  fee: 100000,
  nonce: 0,
  privateKeyHex: sender.privateKeyHex,
});

const local = verifyTransaction(tx);

console.log(
  JSON.stringify(
    {
      senderAddress: sender.address,
      recipientAddress: recipient.address,
      addressValidTS: validateAddress(sender.address),
      localVerify: local,
      tx: toRPCJSON(tx),
    },
    null,
    2,
  ),
);
