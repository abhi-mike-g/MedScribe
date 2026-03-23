/**
 * E2EE (End-to-End Encryption) Module for MedScribe
 * 
 * Architecture:
 * - On Android: Keys stored in Android Keystore (hardware-backed)
 * - On iOS: Keys stored in iOS Keychain (hardware-backed)
 * - On Web: Keys stored via Web Crypto API (SubtleCrypto)
 * 
 * Flow:
 * 1. On registration/first launch, generate RSA-2048 key pair
 * 2. Public key is sent to server
 * 3. Private key NEVER leaves device (stored in Keystore/Keychain)
 * 4. To encrypt a file: generate random AES-256-GCM key, encrypt file
 * 5. Encrypt the AES key with recipient's RSA public key
 * 6. Send encrypted file + encrypted AES key to server
 * 7. Recipient decrypts AES key with their private key from Keystore
 * 8. Recipient decrypts file with AES key
 */

import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

const E2EE_PRIVATE_KEY = 'medscribe_e2ee_private_key';
const E2EE_PUBLIC_KEY = 'medscribe_e2ee_public_key';
const E2EE_KEY_ID = 'medscribe_e2ee_key_id';

// ============ KEY GENERATION & STORAGE ============

/**
 * Generate an RSA key pair. Private key stored in Keystore/Keychain.
 * Returns the public key PEM for server registration.
 */
export async function generateKeyPair(): Promise<{ publicKeyPem: string; keyId: string }> {
  if (Platform.OS === 'web') {
    return generateWebCryptoKeyPair();
  }
  return generateNativeKeyPair();
}

async function generateNativeKeyPair(): Promise<{ publicKeyPem: string; keyId: string }> {
  // On native, use expo-crypto for random bytes and expo-secure-store for storage
  // Generate a key ID
  const keyId = Crypto.randomUUID();

  // Generate RSA key pair using Web Crypto API (available in Hermes/JSC)
  const keyPair = await globalThis.crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true, // extractable for export
    ['encrypt', 'decrypt']
  );

  // Export public key as PEM
  const publicKeyBuffer = await globalThis.crypto.subtle.exportKey('spki', keyPair.publicKey);
  const publicKeyPem = arrayBufferToPem(publicKeyBuffer, 'PUBLIC KEY');

  // Export private key and store securely
  const privateKeyBuffer = await globalThis.crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
  const privateKeyBase64 = arrayBufferToBase64(privateKeyBuffer);

  // Store in Keystore/Keychain via expo-secure-store
  await SecureStore.setItemAsync(E2EE_PRIVATE_KEY, privateKeyBase64, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  await SecureStore.setItemAsync(E2EE_PUBLIC_KEY, publicKeyPem);
  await SecureStore.setItemAsync(E2EE_KEY_ID, keyId);

  return { publicKeyPem, keyId };
}

async function generateWebCryptoKeyPair(): Promise<{ publicKeyPem: string; keyId: string }> {
  const keyId = crypto.randomUUID ? crypto.randomUUID() : `web-${Date.now()}`;

  const keyPair = await crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['encrypt', 'decrypt']
  );

  const publicKeyBuffer = await crypto.subtle.exportKey('spki', keyPair.publicKey);
  const publicKeyPem = arrayBufferToPem(publicKeyBuffer, 'PUBLIC KEY');

  const privateKeyBuffer = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
  const privateKeyBase64 = arrayBufferToBase64(privateKeyBuffer);

  // On web, store in localStorage (fallback - less secure than Keystore)
  try {
    localStorage.setItem(E2EE_PRIVATE_KEY, privateKeyBase64);
    localStorage.setItem(E2EE_PUBLIC_KEY, publicKeyPem);
    localStorage.setItem(E2EE_KEY_ID, keyId);
  } catch (e) {
    console.warn('Failed to store keys in localStorage:', e);
  }

  return { publicKeyPem, keyId };
}

// ============ KEY RETRIEVAL ============

export async function getStoredPublicKey(): Promise<string | null> {
  if (Platform.OS === 'web') {
    try { return localStorage.getItem(E2EE_PUBLIC_KEY); } catch { return null; }
  }
  return SecureStore.getItemAsync(E2EE_PUBLIC_KEY);
}

async function getStoredPrivateKeyBase64(): Promise<string | null> {
  if (Platform.OS === 'web') {
    try { return localStorage.getItem(E2EE_PRIVATE_KEY); } catch { return null; }
  }
  return SecureStore.getItemAsync(E2EE_PRIVATE_KEY);
}

export async function hasE2EEKeys(): Promise<boolean> {
  const pk = await getStoredPublicKey();
  return !!pk;
}

// ============ ENCRYPTION ============

/**
 * Encrypt data with AES-256-GCM. Returns encrypted data + IV + the raw AES key.
 */
export async function encryptData(plainData: ArrayBuffer): Promise<{
  encryptedData: ArrayBuffer;
  iv: string; // base64
  aesKey: ArrayBuffer;
}> {
  // Generate random AES-256 key
  const aesKey = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );

  // Generate random IV (12 bytes for GCM)
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Encrypt
  const encryptedData = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    plainData
  );

  const rawAesKey = await crypto.subtle.exportKey('raw', aesKey);

  return {
    encryptedData,
    iv: arrayBufferToBase64(iv.buffer),
    aesKey: rawAesKey,
  };
}

/**
 * Encrypt an AES key with a recipient's RSA public key PEM.
 */
export async function encryptAesKeyWithPublicKey(
  aesKeyBuffer: ArrayBuffer,
  recipientPublicKeyPem: string
): Promise<string> {
  const publicKey = await importPublicKeyFromPem(recipientPublicKeyPem);
  const encrypted = await crypto.subtle.encrypt(
    { name: 'RSA-OAEP' },
    publicKey,
    aesKeyBuffer
  );
  return arrayBufferToBase64(encrypted);
}

// ============ DECRYPTION ============

/**
 * Decrypt an AES key using our private key from Keystore.
 */
export async function decryptAesKeyWithPrivateKey(
  encryptedAesKeyBase64: string
): Promise<ArrayBuffer> {
  const privateKeyBase64 = await getStoredPrivateKeyBase64();
  if (!privateKeyBase64) throw new Error('No private key in Keystore');

  const privateKeyBuffer = base64ToArrayBuffer(privateKeyBase64);
  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    privateKeyBuffer,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['decrypt']
  );

  const encryptedBuffer = base64ToArrayBuffer(encryptedAesKeyBase64);
  return crypto.subtle.decrypt({ name: 'RSA-OAEP' }, privateKey, encryptedBuffer);
}

/**
 * Decrypt data with AES-256-GCM key and IV.
 */
export async function decryptData(
  encryptedData: ArrayBuffer,
  aesKeyBuffer: ArrayBuffer,
  ivBase64: string
): Promise<ArrayBuffer> {
  const aesKey = await crypto.subtle.importKey(
    'raw',
    aesKeyBuffer,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );
  const iv = base64ToArrayBuffer(ivBase64);
  return crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(iv) }, aesKey, encryptedData);
}

// ============ HELPER UTILITIES ============

async function importPublicKeyFromPem(pem: string): Promise<CryptoKey> {
  const pemBody = pem
    .replace(/-----BEGIN PUBLIC KEY-----/, '')
    .replace(/-----END PUBLIC KEY-----/, '')
    .replace(/\s/g, '');
  const buffer = base64ToArrayBuffer(pemBody);
  return crypto.subtle.importKey(
    'spki',
    buffer,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['encrypt']
  );
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function arrayBufferToPem(buffer: ArrayBuffer, type: string): string {
  const base64 = arrayBufferToBase64(buffer);
  const lines = base64.match(/.{1,64}/g) || [];
  return `-----BEGIN ${type}-----\n${lines.join('\n')}\n-----END ${type}-----`;
}

/**
 * Encrypt a file (Blob/ArrayBuffer) for a specific recipient.
 * Returns everything needed to upload the encrypted file.
 */
export async function encryptFileForRecipient(
  fileData: ArrayBuffer,
  recipientPublicKeyPem: string
): Promise<{
  encryptedData: ArrayBuffer;
  iv: string;
  encryptedAesKey: string;
}> {
  const { encryptedData, iv, aesKey } = await encryptData(fileData);
  const encryptedAesKey = await encryptAesKeyWithPublicKey(aesKey, recipientPublicKeyPem);
  return { encryptedData, iv, encryptedAesKey };
}

/**
 * Decrypt a file using our private key from Keystore.
 */
export async function decryptFileFromSender(
  encryptedData: ArrayBuffer,
  encryptedAesKeyBase64: string,
  ivBase64: string
): Promise<ArrayBuffer> {
  const aesKeyBuffer = await decryptAesKeyWithPrivateKey(encryptedAesKeyBase64);
  return decryptData(encryptedData, aesKeyBuffer, ivBase64);
}
