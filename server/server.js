import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import {
  Client,
  PrivateKey,
  ContractExecuteTransaction,
  ContractFunctionParameters,
  Hbar,
  AccountId,
  TokenId,
} from "@hashgraph/sdk";
import { Buffer } from "buffer";
import { promises as fs } from "fs";
import { fileURLToPath } from "url";

const app = express();

app.use(
  cors({
    origin: "http://localhost:8080",
    credentials: true,
  })
);

app.use(bodyParser.json());

dotenv.config();

const PORT = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LEADERBOARD_FILE = path.join(__dirname, "leaders.json");
const MAX_LEADERS = 5;

// Middleware to parse JSON
app.use(express.json());

const OPERATOR_ID = AccountId.fromString(process.env.OPERATOR_ID);
const OPERATOR_KEY = PrivateKey.fromStringDer(process.env.OPERATOR_KEY);
const contractId = process.env.CONTRACT_ID;
const TOKEN_ID = TokenId.fromString(process.env.TOKEN_ID);

const client = Client.forName("testnet").setOperator(OPERATOR_ID, OPERATOR_KEY);

const CID = [
  "bafkreifuscueitkigrok6k6x4wmil2n52nki4sis3u7h3k6hexekrp7yte",
  "bafkreicuj6i5iggvkrsduy4ii52e4xzk7hulntfxywaos66xuwfzesi7hy",
  "bafkreidtyyug6yhvwbbnk3efiguavl5colwlvuatlrihogkcrdcl6p2f6u",
];

const random = `ipfs://${CID[Math.floor(Math.random() * CID.length)]}`;

app.get("/api/mint-nft/:receiverAddress", async (req, res) => {
  try {
    const receiverAddress = req.params.receiverAddress;

    const serial = await mintNft(receiverAddress);

    res.status(200).json({ serial: serial.toString() });
  } catch (error) {
    console.error("Express Server Error:", error);
    res.status(500).json({ error: error.message });
  }
});

async function mintNft(receiverAddress) {
  const mintToken = new ContractExecuteTransaction()
    .setContractId(contractId)
    .setGas(4000000)
    .setMaxTransactionFee(new Hbar(20))
    .setFunction(
      "mintNft",
      new ContractFunctionParameters()
        .addAddress(TOKEN_ID.toSolidityAddress())
        .addBytesArray([Buffer.from(random)])
    );

  const mintTokenTx = await mintToken.execute(client);
  const mintTokenRx = await mintTokenTx.getRecord(client);
  const serial = mintTokenRx.contractFunctionResult.getInt64(0);

  const transferToken = await new ContractExecuteTransaction()
    .setContractId(contractId)
    .setGas(4000000)
    .setFunction(
      "transferNft",
      new ContractFunctionParameters()
        .addAddress(TOKEN_ID.toSolidityAddress())
        .addAddress(String(receiverAddress))
        .addInt64(serial)
    );

  const transferTokenTx = await transferToken.execute(client);
  const transferTokenRx = await transferTokenTx.getReceipt(client);

  console.log(`Transfer status: ${transferTokenRx.status} \n`);

  return serial;
}

// Get leaders from file
async function getLeaders() {
  try {
    const data = await fs.readFile(LEADERBOARD_FILE, "utf8");
    return JSON.parse(data);
  } catch (error) {
    if (error.code === "ENOENT") {
      await fs.writeFile(LEADERBOARD_FILE, JSON.stringify([], null, 2));
      return [];
    }
    console.error("Error reading leaders:", error);
    return [];
  }
}

// Save leaders to file
async function saveLeaders(leaders) {
  try {
    await fs.writeFile(LEADERBOARD_FILE, JSON.stringify(leaders, null, 2));
    return true;
  } catch (error) {
    console.error("Error saving leaders:", error);
    return false;
  }
}

// Update leaderboard with new score
async function updateLeaderboard(accountId, score) {
  try {
    const leaders = await getLeaders();

    const existingPlayerIndex = leaders.findIndex(
      (leader) => leader.accountId === accountId
    );

    if (existingPlayerIndex !== -1) {
      if (score > leaders[existingPlayerIndex].score) {
        leaders[existingPlayerIndex].score = score;
      }
    } else {
      leaders.push({
        name: accountId,
        score: score,
        accountId: accountId,
      });
    }

    leaders.sort((a, b) => b.score - a.score);

    // Keep only top MAX_LEADERS
    const updatedLeaders = leaders.slice(0, MAX_LEADERS);

    await saveLeaders(updatedLeaders);

    return {
      success: true,
      leaders: updatedLeaders,
      madeLeaderboard: updatedLeaders.some(
        (leader) => leader.accountId === accountId
      ),
    };
  } catch (error) {
    console.error("Error updating leaderboard:", error);
    return { success: false, error: error.message };
  }
}

// API 1: Get all leaders
app.get("/leader", async (req, res) => {
  try {
    const leaders = await getLeaders();
    res.json(leaders);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Failed to get leaders" });
  }
});

// API 2: Submit new score
app.post("/score", async (req, res) => {
  try {
    const { accountId, score } = req.body;

    if (!accountId) {
      return res.status(400).json({ error: "accountId is required" });
    }

    if (typeof score !== "number" || score < 0) {
      return res.status(400).json({ error: "Valid score is required" });
    }

    const result = await updateLeaderboard(accountId, score);

    if (result.success) {
      res.json({
        success: true,
        madeLeaderboard: result.madeLeaderboard,
        leaders: result.leaders,
      });
    } else {
      res.status(500).json({ error: "Failed to update leaderboard" });
    }
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`GET  http://localhost:${PORT}/leader - Get leaders`);
  console.log(`POST http://localhost:${PORT}/score - Submit score`);
  console.log(`GET http://localhost:${PORT}/api/mint-nft/:receiverAddress`);
});
