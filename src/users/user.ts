import bodyParser from "body-parser";
import express from "express";
import { BASE_USER_PORT, REGISTRY_PORT, BASE_ONION_ROUTER_PORT } from "../config";
import { error } from "console";
import { Node } from "../registry/registry";
import { createRandomSymmetricKey, exportSymKey, rsaEncrypt, symEncrypt } from "../crypto";


export type SendMessageBody = {
  message: string;
  destinationUserId: number;
};

export async function user(userId: number) {
  const _user = express();
  _user.use(express.json());
  _user.use(bodyParser.json());

  var lastReceivedMessage: string | null = null;
  var lastSentMessage: string | null = null;
  let getLastCircuit: Node[] = [];

  _user.get("/status", (req, res) => {
    res.send("live");
  });

  _user.get("/getLastReceivedMessage", (req, res) => {
    res.json({ result: lastReceivedMessage });
  });

  _user.get("/getLastSentMessage", (req, res) => {
    res.json({ result: lastSentMessage });
  });

  // Receive
  _user.post("/message", (req, res) => {
    const { message } = req.body
    lastReceivedMessage = message;
    res.status(200).send("success");
  });

  _user.post("/sendMessage", async (req, res) => {
    const { message, destinationUserId } = req.body;
    lastSentMessage = message;
    
    const nodes = await fetch(`http://localhost:${REGISTRY_PORT}/getNodeRegistry`).then((res) => res.json()).then((body: any) => body.nodes);
    for (let i = 0; i < nodes.length; i++) {
      const j = Math.floor(Math.random() * (i + 1));
      [nodes[i], nodes[j]] = [nodes[j], nodes[i]];
    }
    const circuit: Node[] = nodes.slice(0, 3);

    let destination = `${BASE_USER_PORT + destinationUserId}`.padStart(10, "0") 
    let payload = message;
    for (let i = 0; i < circuit.length; i++) {
      const AESKey = await createRandomSymmetricKey();
      const encPayload = await symEncrypt(AESKey, `${destination}${payload}`); 
      const encAESKey = await rsaEncrypt(await exportSymKey(AESKey), circuit[i].pubKey); 

      destination = `${BASE_ONION_ROUTER_PORT + circuit[i].nodeId}`.padStart(10, "0")
      payload = encAESKey + encPayload; 
    }
    circuit.reverse(); 
    getLastCircuit = circuit;

    await fetch(`http://localhost:${BASE_ONION_ROUTER_PORT + circuit[0].nodeId}/message`, {
      method: "POST",
      body: JSON.stringify({ message: payload }),
      headers: { "Content-Type": "application/json" },
    });
    res.status(200).send("success");
  });

  _user.get("/getLastCircuit", (req, res) => {
    res.status(200).json({result: getLastCircuit.map((node) => node.nodeId)});
  });

  const server = _user.listen(BASE_USER_PORT + userId, () => {
    console.log(
      `User ${userId} is listening on port ${BASE_USER_PORT + userId}`
    );
  });

  return server;
}
