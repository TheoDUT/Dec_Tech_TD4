import bodyParser from "body-parser";
import express, { Request, Response } from "express";
import { REGISTRY_PORT } from "../config";
import { error } from "console";
import e from "express";

export type Node = { nodeId: number; pubKey: string };

export type RegisterNodeBody = {
  nodeId: number;
  pubKey: string;
};

export type GetNodeRegistryBody = {
  nodes: Node[];
};

export async function launchRegistry() {
  const _registry = express();
  _registry.use(express.json());
  _registry.use(bodyParser.json());

  let nodes: Node[] = [];

  _registry.get("/status", (req, res) => {
    res.send("live");
  });

  _registry.post('/registerNode', (req, res) => {
    const {nodeId, pubKey} = req.body;
    const node: Node = {nodeId, pubKey};

    nodes.push(node);
    res.status(200).send();
  });

  _registry.get("/getNodeRegistry", (req, res) => {
    const registry: GetNodeRegistryBody = { nodes };
    res.status(200).json(registry);
  });

  const server = _registry.listen(REGISTRY_PORT, () => {
    console.log(`registry is listening on port ${REGISTRY_PORT}`);
  });

  return server;
}
