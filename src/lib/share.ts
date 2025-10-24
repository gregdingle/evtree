import {
  getDownloadURL,
  getStorage,
  ref,
  uploadBytes,
} from "@firebase/storage";
import { keys } from "es-toolkit/compat";

import { cleanTree } from "./download";
import { firebaseApp } from "./firebase";
import { DecisionTree } from "./tree";

async function generateContentHash(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await window.crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  // Use first 16 characters for reasonable length while maintaining uniqueness
  return hashHex.substring(0, 16);
}

export async function uploadTreeForSharing(
  tree: DecisionTree,
): Promise<string> {
  const json = JSON.stringify(cleanTree(tree), null, 2);
  const contentHash = await generateContentHash(json);
  const storageRef = ref(getStorage(firebaseApp), `share/${contentHash}.json`);
  const blob = new Blob([json], { type: "application/json" });

  // TODO: is it safe to store all this metadata unencrypted?
  const customMetadata = {
    id: tree.id,
    name: tree.name,
    // NOTE: probably not safe to store description unencrypted
    // description: tree.description ?? "",
    createdAt: tree.createdAt,
    updatedAt: tree.updatedAt ?? "",
    nodes: keys(tree.nodes).length.toString(),
    edges: keys(tree.edges).length.toString(),
    variables: keys(tree.variables ?? {}).length.toString(),
  };

  const snapshot = await uploadBytes(storageRef, blob, {
    contentType: "application/json",
    cacheControl: "public,max-age=31536000,immutable",
    contentEncoding: "utf-8",
    contentDisposition: "inline",
    customMetadata,
  });
  return await getDownloadURL(snapshot.ref);
}
