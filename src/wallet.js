import {
  DAppConnector,
  HederaJsonRpcMethod,
  HederaSessionEvent,
  HederaChainId,
} from "@hashgraph/hedera-wallet-connect";
import {
  LedgerId,
  ContractExecuteTransaction,
  ContractFunctionParameters,
  AccountId,
} from "@hashgraph/sdk";

// --- App metadata & config ---
const PROJECT_ID = "5eb71c9e42a74b55e2f20d34430bfd82"; // <-- put your WC project id here
const LEDGER = LedgerId.TESTNET; // testnet as requested

const metadata = {
  name: "Dino - Blockchain Game",
  description: "Pixel Dino on Hedera 🎮",
  url: window.location.origin,
  icons: [window.location.origin + "/icon.png"],
};

const CID = [
  "bafkreifuscueitkigrok6k6x4wmil2n52nki4sis3u7h3k6hexekrp7yte",
  "bafkreicuj6i5iggvkrsduy4ii52e4xzk7hulntfxywaos66xuwfzesi7hy",
  "bafkreidtyyug6yhvwbbnk3efiguavl5colwlvuatlrihogkcrdcl6p2f6u",
];

// --- Make sure we only EVER create one connector & one modal in the page life cycle
function getConnectorSingleton() {
  if (window.__HEDERA_WC__?.connector) return window.__HEDERA_WC__.connector;

  const connector = new DAppConnector(
    metadata,
    LEDGER,
    PROJECT_ID,
    Object.values(HederaJsonRpcMethod),
    [HederaSessionEvent.ChainChanged, HederaSessionEvent.AccountsChanged],
    [HederaChainId.Testnet]
  );

  // Save globally so HMR/re-imports reuse the same instance (prevents double <wcm-*> defines)
  window.__HEDERA_WC__ = { connector, initPromise: null };
  return connector;
}

// --- Initialize only once
export async function initWallet() {
  const wc = window.__HEDERA_WC__ || {};
  const connector = getConnectorSingleton();

  if (!wc.initPromise) {
    wc.initPromise = connector.init({ logger: "error" });
    window.__HEDERA_WC__.initPromise = wc.initPromise;
  }
  await wc.initPromise;

  // Return existing account (if session already active)
  const signer = connector.signers?.[0];
  return signer?.getAccountId()?.toString() || null;
}

// --- Open QR modal and connect
export async function connectWallet() {
  const connector = getConnectorSingleton();
  await initWallet();

  try {
    console.log("Opening WalletConnect modal...");
    await connector.openModal(); // shows QR modal
  } catch (e) {
    console.warn("Connect cancelled:", e.message || e);
    return null;
  }

  // Wait for signer to appear (sometimes it's async after approval)
  let signer = null;
  for (let i = 0; i < 10; i++) {
    signer = connector.signers?.[0];
    if (signer) break;
    await new Promise((r) => setTimeout(r, 300));
  }

  const accountId = signer?.getAccountId()?.toString() || null;
  if (accountId) {
    window.currentWallet = { accountId };
    console.log("Connected wallet:", accountId);
  } else {
    console.warn("No signer found after connect");
  }
  return accountId;
}

// --- Disconnect all sessions & pairings
export async function disconnectWallet() {
  const connector = getConnectorSingleton();
  try {
    await connector.disconnectAll();
  } catch (e) {
    console.warn("disconnectAll:", e.message || e);
  }
  window.currentWallet = null;
  return true;
}

// --- Subscribe to wallet state changes (optional)
export function onWalletEvents({ onChange }) {
  const connector = getConnectorSingleton();
  const safeUpdate = () => {
    const s = connector.signers?.[0];
    onChange?.(s ? s.getAccountId().toString() : null);
  };

  // After init, hook into walletconnect client events
  (async () => {
    await initWallet();
    connector.walletConnectClient?.on("session_update", safeUpdate);
    connector.walletConnectClient?.on("session_delete", safeUpdate);
    connector.walletConnectClient?.core?.pairing?.events?.on(
      "pairing_delete",
      safeUpdate
    );
  })();
}

// Convert "0.0.x" to solidity address
function accountIdToSolidityAddress(accountId) {
  return "0x" + AccountId.fromString(accountId).toSolidityAddress();
}

async function mintForHighScore({
  connector,
  playerAccountId,
  metadataUri,
  contractId,
}) {
  const signer = connector.signers[0];
  const recipientSol = accountIdToSolidityAddress(playerAccountId);

  const tx = new ContractExecuteTransaction()
    .setContractId(contractId) // "0.0.contractId"
    .setGas(600_000) // adjust if needed
    .setFunction(
      "mintAndSend",
      new ContractFunctionParameters()
        .addAddress(recipientSol) // solidity address (0x…)
        .addString(metadataUri) // e.g. ipfs://CID/metadata.json
    );

  await tx.freezeWithSigner(signer);
  const res = await tx.executeWithSigner(signer);
  console.log("Mint tx:", res.transactionId.toString());
}
