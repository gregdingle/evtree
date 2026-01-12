import {
  FirebaseStorage,
  getDownloadURL,
  ref,
  uploadBytes,
} from "@firebase/storage";
import { keys } from "es-toolkit/compat";

import { cleanTree } from "./export";
import { DecisionTree } from "./tree";

const fileExtension = ".json.enc";

/**
 * Extract share hash and encryption key from URL
 * @see generateContentHash
 * @see buildShareUrl
 */
export function extractShareHash(): { hash: string; key: string } | null {
  const urlHash = window.location.hash;
  const match = urlHash.match(/#share=([a-f0-9]{16})&key=([A-Za-z0-9_-]+)/);
  if (match && match[1] && match[2]) {
    return { hash: match[1], key: match[2] };
  }
  return null;
}

/**
 * @see extractShareHash
 * @see generateContentHash
 * @see exportKeyToBase64
 */
export function buildShareUrl(contentHash: string, keyBase64: string) {
  const baseUrl = window.location.origin;
  // NOTE: earlier versions used root / path; now we use /builder/
  return `${baseUrl}/builder/#share=${contentHash}&key=${keyBase64}`;
}

export async function uploadTreeForSharing(
  tree: DecisionTree,
  firebaseStorage: FirebaseStorage,
): Promise<string> {
  // Generate encryption key
  const encryptionKey = await generateEncryptionKey();

  // Prepare and encrypt the tree data
  const json = JSON.stringify(cleanTree(tree), null, 2);
  const encrypted = await encryptData(json, encryptionKey);

  // Generate content hash from encrypted data (not plaintext)
  const contentHash = await generateContentHash(encrypted);

  // Upload encrypted data to Firebase Storage
  const storageRef = ref(
    firebaseStorage,
    `share/${contentHash}${fileExtension}`,
  );

  // NOTE: Metadata is not encrypted, but doesn't contain sensitive tree content
  const customMetadata = {
    id: tree.id,
    // name: tree.name, // NOTE: omit name to enhance privacy.
    createdAt: tree.createdAt,
    updatedAt: tree.updatedAt ?? "",
    nodes: keys(tree.nodes).length.toString(),
    edges: keys(tree.edges).length.toString(),
    variables: (tree.variables ?? []).length.toString(),
  };

  await uploadBytes(storageRef, encrypted, {
    contentType: "application/octet-stream", // Binary encrypted data
    cacheControl: "public,max-age=31536000,immutable",
    customMetadata,
  });

  // Export key to base64 for URL
  const keyBase64 = await exportKeyToBase64(encryptionKey);

  // Return URL with hash and encryption key in fragment
  return buildShareUrl(contentHash, keyBase64);
}

export async function downloadSharedTree(
  contentHash: string,
  keyBase64: string,
  firebaseStorage: FirebaseStorage,
): Promise<DecisionTree> {
  try {
    // Get encrypted data from Firebase Storage
    const storageRef = ref(
      firebaseStorage,
      `share/${contentHash}${fileExtension}`,
    );
    const downloadURL = await getDownloadURL(storageRef);
    const response = await fetch(downloadURL);

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status}: ${response.statusText || "Failed to fetch"}`,
      );
    }

    const encrypted = await response.arrayBuffer();

    // Import encryption key and decrypt
    const key = await importKeyFromBase64(keyBase64);
    const decrypted = await decryptData(encrypted, key);

    // Parse and return tree
    return JSON.parse(decrypted);
  } catch (error) {
    if (error instanceof Error) {
      // Provide more helpful error messages
      if (error.message.includes("storage/object-not-found")) {
        throw new Error(
          `Tree not found. The shared link may be invalid or expired.`,
        );
      }
      if (error.message.includes("storage/unauthorized")) {
        throw new Error(
          `Access denied. Check Firebase Storage security rules.`,
        );
      }
      if (
        error.message.includes("OperationError") ||
        error.name === "OperationError"
      ) {
        throw new Error(
          `Decryption failed. The encryption key may be incorrect or corrupted.`,
        );
      }
      throw error;
    }
    throw new Error(
      `Unknown error occurred while loading shared tree: ${error}`,
    );
  }
}

/**
 * Generate AES-GCM encryption key for E2EE
 */
export async function generateEncryptionKey(): Promise<CryptoKey> {
  return await window.crypto.subtle.generateKey(
    { name: "AES-GCM", length: 128 },
    true, // extractable
    ["encrypt", "decrypt"],
  );
}

/**
 * Export encryption key to base64 string for URL
 */
export async function exportKeyToBase64(key: CryptoKey): Promise<string> {
  const jwk = await window.crypto.subtle.exportKey("jwk", key);
  return jwk.k!; // k is the base64-encoded key material
}

/**
 * Import encryption key from base64 string
 */
export async function importKeyFromBase64(
  keyBase64: string,
): Promise<CryptoKey> {
  return await window.crypto.subtle.importKey(
    "jwk",
    {
      k: keyBase64,
      alg: "A128GCM",
      ext: true,
      key_ops: ["encrypt", "decrypt"],
      kty: "oct",
    },
    { name: "AES-GCM", length: 128 },
    false, // not extractable
    ["decrypt"],
  );
}

/**
 * Encrypt data using AES-GCM
 */
export async function encryptData(
  data: string,
  key: CryptoKey,
): Promise<ArrayBuffer> {
  const encoded = new TextEncoder().encode(data);
  // NOTE: Using zero IV is safe here because we generate a new random key for each upload
  // and never reuse the same key (content-addressed storage ensures uniqueness)
  return await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: new Uint8Array(12) },
    key,
    encoded,
  );
}

/**
 * Decrypt data using AES-GCM
 */
export async function decryptData(
  encrypted: ArrayBuffer,
  key: CryptoKey,
): Promise<string> {
  const decrypted = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: new Uint8Array(12) },
    key,
    encrypted,
  );
  return new TextDecoder().decode(decrypted);
}

/**
 * Generate content hash from encrypted data (not plaintext)
 * @see extractShareHash
 */
export async function generateContentHash(
  content: BufferSource,
): Promise<string> {
  const hashBuffer = await window.crypto.subtle.digest("SHA-256", content);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  // Use first 16 characters for reasonable length while maintaining uniqueness
  return hashHex.substring(0, 16);
}
