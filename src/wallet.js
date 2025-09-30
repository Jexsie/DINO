import {
  DAppConnector,
  HederaJsonRpcMethod,
  HederaSessionEvent,
  HederaChainId,
} from "@hashgraph/hedera-wallet-connect";
import {
  LedgerId,
  AccountId,
  TokenAssociateTransaction,
  TokenId,
} from "@hashgraph/sdk";
import { Buffer } from "buffer";
import { apiUrl } from "./constants";

window.Buffer = Buffer;

const LEDGER = LedgerId.TESTNET;
const PROJECT_ID = import.meta.env.VITE_PROJECT_ID;
const PINATA_GATEWAY = import.meta.env.VITE_PINATA_GATEWAY;
const TOKEN_ID = TokenId.fromString(import.meta.env.VITE_TOKEN_ID);

console.log(PROJECT_ID, "asdfsada");

const metadata = {
  name: "Dino - Blockchain Game",
  description: "Pixel Dino on Hedera",
  url: window.location.origin,
  icons: [window.location.origin + "/icon.png"],
};

export function getConnectorSingleton() {
  if (window.__HEDERA_WC__?.connector) return window.__HEDERA_WC__.connector;

  const connector = new DAppConnector(
    metadata,
    LEDGER,
    PROJECT_ID,
    Object.values(HederaJsonRpcMethod),
    [HederaSessionEvent.ChainChanged, HederaSessionEvent.AccountsChanged],
    [HederaChainId.Testnet]
  );

  window.__HEDERA_WC__ = { connector, initPromise: null };
  return connector;
}

/******* Initialize only once ****/
export async function initWallet() {
  const wc = window.__HEDERA_WC__ || {};
  const connector = getConnectorSingleton();

  if (!wc.initPromise) {
    wc.initPromise = connector.init({ logger: "error" });
    window.__HEDERA_WC__.initPromise = wc.initPromise;
  }
  await wc.initPromise;

  const signer = connector.signers?.[0];
  return signer?.getAccountId()?.toString() || null;
}

/******  Opens QR modal to connect *****/
export async function connectWallet() {
  const connector = getConnectorSingleton();
  await initWallet();

  try {
    console.log("Opening WalletConnect modal...");
    await connector.openModal();
  } catch (e) {
    console.warn("Connect cancelled:", e.message || e);
    return null;
  }

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

/*********  Subscribe to wallet state changes *****/
export function onWalletEvents({ onChange }) {
  const connector = getConnectorSingleton();
  const safeUpdate = () => {
    const s = connector.signers?.[0];
    onChange?.(s ? s.getAccountId().toString() : null);
  };

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

export async function requestAssociation() {
  const connector = getConnectorSingleton();
  const signer = connector.signers[0];
  const accountId = signer.getAccountId().toString();
  const isAssociated = await checkAssociation(accountId);

  if (isAssociated) return;

  const tx = await new TokenAssociateTransaction()
    .setAccountId(accountId)
    .setTokenIds([TOKEN_ID])
    .freezeWithSigner(signer);

  const res = await tx.executeWithSigner(signer);
  console.log("Association Tx:", res.transactionId.toString());
  return res;
}

export async function mintForHighScore(highScore) {
  try {
    await requestAssociation();
    const response = await fetch(
      `${apiUrl}/api/mint-nft/${AccountId.fromString(
        window.currentWallet.accountId
      ).toSolidityAddress()}`
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Backend minting failed.");
    }

    const { serial } = await response.json();
    await submitScore(window.currentWallet.accountId, highScore);
  } catch (error) {
    console.error("Error during mint and transfer:", error);
  }
}

export async function getNftsForUser(accountId) {
  const results = [];

  try {
    const res = await fetch(
      `https://testnet.mirrornode.hedera.com/api/v1/accounts/${accountId}/nfts?limit=4&order=desc&token.id=${TOKEN_ID.toString()}`
    );

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || "Backend minting failed.");
    }

    const data = await res.json();

    for (const nft of data?.nfts) {
      try {
        const url = decodeMetadata(nft.metadata);
        const metadata = await fetchMetadata(normalizeIpfsUri(url));
        results.push({
          ...metadata,
          tokenId: nft.token_id,
          serial: nft.serial_number,
        });
      } catch (err) {
        console.error("Failed to fetch metadata for NFT", nft, err);
      }
    }
    return results;
  } catch {}
}

async function submitScore(accountId, score) {
  try {
    const response = await fetch(apiUrl + "/score", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        accountId: accountId,
        score: score,
        name: accountId,
      }),
    });

    return await response.json();
  } catch (error) {
    console.error("Error submitting score:", error);
    return { success: false, error: "Network error" };
  }
}

async function fetchMetadata(url) {
  const response = await fetch(url);
  return await response.json();
}

async function checkAssociation(accountId) {
  const url = `https://testnet.mirrornode.hedera.com/api/v1/accounts/${accountId}/tokens`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Mirror Node error");
  const data = await res.json();

  return data.tokens.some((t) => t.token_id === TOKEN_ID.toString());
}

function decodeMetadata(base64Metadata) {
  const buff = Buffer.from(base64Metadata, "base64");
  return buff.toString("utf-8");
}

export function normalizeIpfsUri(uri) {
  if (!uri) return null;

  if (uri.startsWith("ipfs://")) {
    const cid = uri.replace("ipfs://", "");
    return `${PINATA_GATEWAY}/ipfs/${cid}`;
  }
  return uri;
}
