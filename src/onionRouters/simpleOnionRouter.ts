import bodyParser from "body-parser";
import express from "express";
import { BASE_ONION_ROUTER_PORT, REGISTRY_PORT } from "../config";
import { generateRsaKeyPair, exportPubKey, exportPrvKey, rsaDecrypt, symDecrypt, importPrvKey } from "../crypto";
import { error } from "console";
import e from "express";

export async function simpleOnionRouter(nodeId: number) {
  const onionRouter = express();
  onionRouter.use(express.json());
  onionRouter.use(bodyParser.json());

  var lastReceivedEncryptedMessage: string | null = null;
  var lastReceivedDecryptedMessage: string | null = null;
  var lastMessageDestination: number | null = null;

  onionRouter.get("/status", (req, res) => {
    res.send("live");
  });

  onionRouter.get("/getLastReceivedEncryptedMessage", (req, res) => {
    res.json({ result: lastReceivedEncryptedMessage });
  });

  onionRouter.get("/getLastReceivedDecryptedMessage", (req, res) => {
    res.json({ result: lastReceivedDecryptedMessage });
  });

  onionRouter.get("/getLastMessageDestination", (req, res) => {
    res.json({ result: lastMessageDestination });
  });


  // Register the node with the registry
  const keyPair = await generateRsaKeyPair();
  const publicKey = await exportPubKey(keyPair.publicKey);
  const privateKey = await exportPrvKey(keyPair.privateKey);
  
  const response = await fetch(`http://localhost:${REGISTRY_PORT}/registerNode`, {
    method: "POST",
    body: JSON.stringify({ nodeId: nodeId, pubKey: publicKey }),
    headers: { "Content-Type": "application/json" },
  });

  onionRouter.get("/getPrivateKey", async (req, res) => {
    res.json({ result: privateKey });
  });
  
  onionRouter.post("/message", async (req, res) => {
    const layer = req.body.message;
    const AESKey = privateKey ? await rsaDecrypt(layer.slice(0, 344), await importPrvKey(privateKey)) : null;
    const payload = AESKey ? await symDecrypt(AESKey, layer.slice(344)) : null;

    lastReceivedEncryptedMessage = layer;
    lastReceivedDecryptedMessage = payload ? payload.slice(10) : null;
    lastMessageDestination = payload ? parseInt(payload.slice(0, 10), 10) : null;

    if (lastMessageDestination) {
      await fetch(`http://localhost:${lastMessageDestination}/message`, {
        method: "POST",
        body: JSON.stringify({ message: lastReceivedDecryptedMessage }),
        headers: { "Content-Type": "application/json" },
      });
    }

    res.status(200).send({ result: "Success" });
  });

  const server = onionRouter.listen(BASE_ONION_ROUTER_PORT + nodeId, () => {
    console.log(
      `Onion router ${nodeId} is listening on port ${
        BASE_ONION_ROUTER_PORT + nodeId
      }`
    );
  });

  return server;
}
