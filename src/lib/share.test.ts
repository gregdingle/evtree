/**
 * @jest-environment jsdom
 */
import { webcrypto } from "node:crypto";
import { TextDecoder, TextEncoder } from "node:util";

import {
  buildShareUrl,
  decryptData,
  encryptData,
  exportKeyToBase64,
  extractShareHash,
  generateContentHash,
  generateEncryptionKey,
  importKeyFromBase64,
} from "./share";

// Polyfill Web Crypto API for Node.js Jest environment
Object.defineProperty(global, "crypto", {
  value: {
    subtle: webcrypto.subtle,
  },
});

// Polyfill TextEncoder/TextDecoder
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder as typeof global.TextDecoder;

// Mock window.location.hash for tests
const mockHash = (hash: string) => {
  Object.defineProperty(window, "location", {
    value: { hash },
    writable: true,
  });
};

// Mock window.location.origin for buildShareUrl tests
const mockOrigin = (origin: string) => {
  Object.defineProperty(window, "location", {
    value: {
      ...window.location,
      origin,
    },
    writable: true,
  });
};

describe("share.ts encryption utilities", () => {
  describe("extractShareHash", () => {
    it("should extract valid hash and key from URL", () => {
      mockHash("#share=394ff0e908376c69&key=BQ1moYESmTEXgtA1KozyVw");
      const result = extractShareHash();

      expect(result).toEqual({
        hash: "394ff0e908376c69",
        key: "BQ1moYESmTEXgtA1KozyVw",
      });
    });

    it("should return null for invalid hash format (too short)", () => {
      mockHash("#share=394ff0e90837&key=BQ1moYESmTEXgtA1KozyVw");
      const result = extractShareHash();

      expect(result).toBeNull();
    });

    it("should return null for invalid hash format (non-hex)", () => {
      mockHash("#share=394ff0e908376c6g&key=BQ1moYESmTEXgtA1KozyVw");
      const result = extractShareHash();

      expect(result).toBeNull();
    });

    it("should return null when key is missing", () => {
      mockHash("#share=394ff0e908376c69");
      const result = extractShareHash();

      expect(result).toBeNull();
    });

    it("should return null when hash is missing", () => {
      mockHash("#key=BQ1moYESmTEXgtA1KozyVw");
      const result = extractShareHash();

      expect(result).toBeNull();
    });

    it("should return null for empty hash", () => {
      mockHash("");
      const result = extractShareHash();

      expect(result).toBeNull();
    });

    it("should handle URL with other fragments", () => {
      mockHash("#foo=bar&share=394ff0e908376c69&key=BQ1moYESmTEXgtA1KozyVw");
      const result = extractShareHash();

      // Should still be null because regex expects exact format
      expect(result).toBeNull();
    });

    it("should accept valid base64url characters in key", () => {
      mockHash("#share=394ff0e908376c69&key=ABC123-_xyz");
      const result = extractShareHash();

      expect(result).toEqual({
        hash: "394ff0e908376c69",
        key: "ABC123-_xyz",
      });
    });
  });

  describe("buildShareUrl", () => {
    it("should build valid share URL with localhost origin", () => {
      mockOrigin("http://localhost:3000");

      const url = buildShareUrl("394ff0e908376c69", "BQ1moYESmTEXgtA1KozyVw");

      expect(url).toBe(
        "http://localhost:3000/builder/#share=394ff0e908376c69&key=BQ1moYESmTEXgtA1KozyVw",
      );
    });

    it("should build valid share URL with production domain", () => {
      mockOrigin("https://evtree.ai");

      const url = buildShareUrl("abc123def4567890", "XyZ789AbC123_-Def");

      expect(url).toBe(
        "https://evtree.ai/builder/#share=abc123def4567890&key=XyZ789AbC123_-Def",
      );
    });

    it("should create URL that extractShareHash can parse", () => {
      mockOrigin("https://evtree.ai");

      const contentHash = "a1b2c3d4e5f67890";
      const keyBase64 = "SomeBase64Key_-";

      const url = buildShareUrl(contentHash, keyBase64);

      // Mock the URL hash as if user navigated to it
      const urlObj = new URL(url);
      mockHash(urlObj.hash);

      const extracted = extractShareHash();

      expect(extracted).toEqual({
        hash: contentHash,
        key: keyBase64,
      });
    });

    it("should preserve special base64url characters in key", () => {
      mockOrigin("https://evtree.ai");

      const keyWithSpecialChars = "ABC-_xyz123";
      const url = buildShareUrl("1234567890abcdef", keyWithSpecialChars);

      expect(url).toContain(`&key=${keyWithSpecialChars}`);
      expect(url).not.toContain("&key=ABC%2D"); // Should not URL-encode
    });
  });

  describe("encryption and decryption", () => {
    it("should encrypt and decrypt data successfully", async () => {
      const testKey = await generateEncryptionKey();
      const originalData = JSON.stringify({ test: "data", value: 123 });

      // Encrypt using exported function
      const encrypted = await encryptData(originalData, testKey);

      // Decrypt using exported function
      const decryptedText = await decryptData(encrypted, testKey);

      expect(decryptedText).toBe(originalData);
      expect(JSON.parse(decryptedText)).toEqual({ test: "data", value: 123 });
    });

    it("should produce different encrypted output with different keys", async () => {
      const data = "secret message";

      const key1 = await generateEncryptionKey();
      const key2 = await generateEncryptionKey();

      const encrypted1 = await encryptData(data, key1);
      const encrypted2 = await encryptData(data, key2);

      // Different keys should produce different ciphertext
      expect(new Uint8Array(encrypted1)).not.toEqual(
        new Uint8Array(encrypted2),
      );
    });

    it("should fail to decrypt with wrong key", async () => {
      const data = "secret message";

      const correctKey = await generateEncryptionKey();
      const wrongKey = await generateEncryptionKey();

      const encrypted = await encryptData(data, correctKey);

      // Decrypting with wrong key should throw
      await expect(decryptData(encrypted, wrongKey)).rejects.toThrow();
    });
  });

  describe("key import/export", () => {
    it("should export and import key successfully", async () => {
      // Generate key using exported function
      const originalKey = await generateEncryptionKey();

      // Export to base64 using exported function
      const keyBase64 = await exportKeyToBase64(originalKey);

      expect(keyBase64).toBeTruthy();
      expect(typeof keyBase64).toBe("string");
      expect(keyBase64).toMatch(/^[A-Za-z0-9_-]+$/); // Base64url format

      // Import back using exported function
      const importedKey = await importKeyFromBase64(keyBase64);

      // Verify keys work the same
      const testData = "test data for key verification";
      const encrypted = await encryptData(testData, originalKey);
      const decrypted = await decryptData(encrypted, importedKey);

      expect(decrypted).toBe(testData);
    });

    it("should handle round-trip export/import cycle", async () => {
      const key = await generateEncryptionKey();
      const keyBase64 = await exportKeyToBase64(key);
      const reimportedKey = await importKeyFromBase64(keyBase64);

      const data = JSON.stringify({ complex: "data", with: ["arrays", 123] });
      const encrypted = await encryptData(data, key);
      const decrypted = await decryptData(encrypted, reimportedKey);

      expect(JSON.parse(decrypted)).toEqual({
        complex: "data",
        with: ["arrays", 123],
      });
    });
  });

  describe("generateContentHash", () => {
    it("should generate consistent hash for same content", async () => {
      const content = new TextEncoder().encode("test content");

      const hash1 = await generateContentHash(content);
      const hash2 = await generateContentHash(content);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(16);
      expect(hash1).toMatch(/^[a-f0-9]{16}$/);
    });

    it("should generate different hashes for different content", async () => {
      const content1 = new TextEncoder().encode("content 1");
      const content2 = new TextEncoder().encode("content 2");

      const hash1 = await generateContentHash(content1);
      const hash2 = await generateContentHash(content2);

      expect(hash1).not.toBe(hash2);
    });

    it("should generate hash from encrypted data", async () => {
      const key = await generateEncryptionKey();
      const data = "some sensitive data";
      const encrypted = await encryptData(data, key);

      const hash = await generateContentHash(encrypted);

      expect(hash).toHaveLength(16);
      expect(hash).toMatch(/^[a-f0-9]{16}$/);
    });

    it("should accept both ArrayBuffer and Uint8Array", async () => {
      const data = new Uint8Array([1, 2, 3, 4, 5]);
      const hash = await generateContentHash(data);

      expect(hash).toHaveLength(16);
      expect(hash).toMatch(/^[a-f0-9]{16}$/);
      // Known SHA-256 hash of [1,2,3,4,5] starts with...
      expect(hash).toBe("74f81fe167d99b4c");
    });
  });

  describe("end-to-end encryption flow", () => {
    it("should complete full encryption/decryption cycle", async () => {
      const originalData = JSON.stringify({
        name: "Test Tree",
        nodes: { n1: { id: "n1", type: "decision" } },
        edges: { e1: { id: "e1", source: "n1" } },
      });

      // 1. Generate key
      const key = await generateEncryptionKey();

      // 2. Encrypt
      const encrypted = await encryptData(originalData, key);

      // 3. Export key
      const keyBase64 = await exportKeyToBase64(key);

      // 4. Generate hash
      const contentHash = await generateContentHash(encrypted);

      // Simulate sharing via URL
      mockOrigin("https://evtree.ai");
      const shareURL = buildShareUrl(contentHash, keyBase64);
      expect(shareURL).toContain("#share=");
      expect(shareURL).toContain("&key=");

      // 5. Import key
      const importedKey = await importKeyFromBase64(keyBase64);

      // 6. Decrypt
      const decryptedData = await decryptData(encrypted, importedKey);
      const parsed = JSON.parse(decryptedData);

      expect(parsed).toEqual(JSON.parse(originalData));
      expect(parsed.name).toBe("Test Tree");
    });
  });
});
