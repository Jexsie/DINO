import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
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
import dotenv from "dotenv";

const app = express();

app.use(
  cors({
    origin: "http://localhost:8080",
    credentials: true,
  })
);

app.use(bodyParser.json());

dotenv.config();

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

const PORT = 3000;
app.listen(PORT, () => console.log(`API server running on port ${PORT}`));
