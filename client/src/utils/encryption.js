class E2EEncryption {
  constructor() {
    this.algorithm = {
      name: 'AES-GCM',
      length: 256
    };
    this.keyDerivationAlgorithm = {
      name: 'PBKDF2',
      hash: 'SHA-256',
      iterations: 100000
    };
    this.rsaAlgorithm = {
      name: 'RSA-OAEP',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256'
    };
    this.keyPairs = new Map(); // Store key pairs for different users
    this.sharedKeys = new Map(); // Store shared secret keys
  }

  // Generate a new RSA key pair for the current user
  async generateKeyPair() {
    try {
      const keyPair = await window.crypto.subtle.generateKey(
        this.rsaAlgorithm,
        true,
        ['encrypt', 'decrypt']
      );
      
      return keyPair;
    } catch (error) {
      console.error('Failed to generate key pair:', error);
      throw error;
    }
  }

  // Export public key to base64 string
  async exportPublicKey(publicKey) {
    try {
      const exported = await window.crypto.subtle.exportKey('spki', publicKey);
      const exportedAsBase64 = this.arrayBufferToBase64(exported);
      return exportedAsBase64;
    } catch (error) {
      console.error('Failed to export public key:', error);
      throw error;
    }
  }

  // Import public key from base64 string
  async importPublicKey(base64Key) {
    try {
      const keyBuffer = this.base64ToArrayBuffer(base64Key);
      const publicKey = await window.crypto.subtle.importKey(
        'spki',
        keyBuffer,
        this.rsaAlgorithm,
        true,
        ['encrypt']
      );
      return publicKey;
    } catch (error) {
      console.error('Failed to import public key:', error);
      throw error;
    }
  }

  // Generate a shared secret using ECDH
  async generateSharedKey(privateKey, publicKey) {
    try {
      const sharedSecret = await window.crypto.subtle.deriveKey(
        {
          name: 'ECDH',
          public: publicKey
        },
        privateKey,
        this.algorithm,
        true,
        ['encrypt', 'decrypt']
      );
      
      return sharedSecret;
    } catch (error) {
      console.error('Failed to generate shared key:', error);
      throw error;
    }
  }

  // Derive encryption key from password
  async deriveKey(password, salt) {
    try {
      const encoder = new TextEncoder();
      const keyMaterial = await window.crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        'PBKDF2',
        false,
        ['deriveBits', 'deriveKey']
      );

      const key = await window.crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: salt,
          iterations: 100000,
          hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );

      return key;
    } catch (error) {
      console.error('Failed to derive key:', error);
      throw error;
    }
  }

  // Encrypt a message
  async encryptMessage(message, key) {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(message);
      
      // Generate random IV
      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      
      // Encrypt the data
      const encrypted = await window.crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv: iv
        },
        key,
        data
      );

      // Combine IV and encrypted data
      const combined = new Uint8Array(iv.length + encrypted.byteLength);
      combined.set(iv);
      combined.set(new Uint8Array(encrypted), iv.length);

      return this.arrayBufferToBase64(combined.buffer);
    } catch (error) {
      console.error('Failed to encrypt message:', error);
      throw error;
    }
  }

  // Decrypt a message
  async decryptMessage(encryptedMessage, key) {
    try {
      const combined = this.base64ToArrayBuffer(encryptedMessage);
      const combinedArray = new Uint8Array(combined);
      
      // Extract IV and encrypted data
      const iv = combinedArray.slice(0, 12);
      const encrypted = combinedArray.slice(12);
      
      // Decrypt the data
      const decrypted = await window.crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: iv
        },
        key,
        encrypted
      );

      const decoder = new TextDecoder();
      return decoder.decode(decrypted);
    } catch (error) {
      console.error('Failed to decrypt message:', error);
      throw error;
    }
  }

  // Encrypt for specific user (using their public key)
  async encryptForUser(message, recipientPublicKey) {
    try {
      // Generate a random AES key for this message
      const aesKey = await window.crypto.subtle.generateKey(
        this.algorithm,
        true,
        ['encrypt', 'decrypt']
      );

      // Encrypt the message with AES
      const encryptedMessage = await this.encryptMessage(message, aesKey);

      // Export and encrypt the AES key with RSA
      const exportedAesKey = await window.crypto.subtle.exportKey('raw', aesKey);
      const encryptedAesKey = await window.crypto.subtle.encrypt(
        this.rsaAlgorithm,
        recipientPublicKey,
        exportedAesKey
      );

      return {
        encryptedMessage,
        encryptedKey: this.arrayBufferToBase64(encryptedAesKey)
      };
    } catch (error) {
      console.error('Failed to encrypt for user:', error);
      throw error;
    }
  }

  // Decrypt message from specific user
  async decryptFromUser(encryptedData, privateKey) {
    try {
      // Decrypt the AES key with RSA
      const encryptedKeyBuffer = this.base64ToArrayBuffer(encryptedData.encryptedKey);
      const aesKeyBuffer = await window.crypto.subtle.decrypt(
        this.rsaAlgorithm,
        privateKey,
        encryptedKeyBuffer
      );

      // Import the AES key
      const aesKey = await window.crypto.subtle.importKey(
        'raw',
        aesKeyBuffer,
        this.algorithm,
        true,
        ['decrypt']
      );

      // Decrypt the message with AES
      return await this.decryptMessage(encryptedData.encryptedMessage, aesKey);
    } catch (error) {
      console.error('Failed to decrypt from user:', error);
      throw error;
    }
  }

  // Generate a digital signature
  async signMessage(message, privateKey) {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(message);
      
      const signature = await window.crypto.subtle.sign(
        {
          name: 'RSA-PSS',
          saltLength: 32
        },
        privateKey,
        data
      );

      return this.arrayBufferToBase64(signature);
    } catch (error) {
      console.error('Failed to sign message:', error);
      throw error;
    }
  }

  // Verify a digital signature
  async verifySignature(message, signature, publicKey) {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(message);
      const signatureBuffer = this.base64ToArrayBuffer(signature);
      
      const isValid = await window.crypto.subtle.verify(
        {
          name: 'RSA-PSS',
          saltLength: 32
        },
        publicKey,
        signatureBuffer,
        data
      );

      return isValid;
    } catch (error) {
      console.error('Failed to verify signature:', error);
      return false;
    }
  }

  // Generate a secure random password
  generateSecurePassword(length = 32) {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    const array = new Uint8Array(length);
    window.crypto.getRandomValues(array);
    
    let password = '';
    for (let i = 0; i < length; i++) {
      password += charset[array[i] % charset.length];
    }
    
    return password;
  }

  // Hash a password
  async hashPassword(password, salt) {
    try {
      const encoder = new TextEncoder();
      const keyMaterial = await window.crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        'PBKDF2',
        false,
        ['deriveBits']
      );

      const derivedBits = await window.crypto.subtle.deriveBits(
        {
          name: 'PBKDF2',
          salt: salt,
          iterations: 100000,
          hash: 'SHA-256'
        },
        keyMaterial,
        256
      );

      return this.arrayBufferToBase64(derivedBits);
    } catch (error) {
      console.error('Failed to hash password:', error);
      throw error;
    }
  }

  // Generate random salt
  generateSalt(length = 16) {
    const salt = window.crypto.getRandomValues(new Uint8Array(length));
    return this.arrayBufferToBase64(salt.buffer);
  }

  // Utility functions
  arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  base64ToArrayBuffer(base64) {
    const binary = window.atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  // Store key pair in IndexedDB
  async storeKeyPair(userId, keyPair) {
    try {
      const db = await this.openDB();
      const transaction = db.transaction(['keys'], 'readwrite');
      const store = transaction.objectStore('keys');
      
      await store.put({
        userId,
        publicKey: await this.exportPublicKey(keyPair.publicKey),
        privateKey: await this.exportPrivateKey(keyPair.privateKey)
      });
    } catch (error) {
      console.error('Failed to store key pair:', error);
      throw error;
    }
  }

  // Retrieve key pair from IndexedDB
  async retrieveKeyPair(userId) {
    try {
      const db = await this.openDB();
      const transaction = db.transaction(['keys'], 'readonly');
      const store = transaction.objectStore('keys');
      
      const result = await store.get(userId);
      if (!result) return null;

      const publicKey = await this.importPublicKey(result.publicKey);
      const privateKey = await this.importPrivateKey(result.privateKey);

      return { publicKey, privateKey };
    } catch (error) {
      console.error('Failed to retrieve key pair:', error);
      return null;
    }
  }

  // Export private key
  async exportPrivateKey(privateKey) {
    try {
      const exported = await window.crypto.subtle.exportKey('pkcs8', privateKey);
      return this.arrayBufferToBase64(exported);
    } catch (error) {
      console.error('Failed to export private key:', error);
      throw error;
    }
  }

  // Import private key
  async importPrivateKey(base64Key) {
    try {
      const keyBuffer = this.base64ToArrayBuffer(base64Key);
      const privateKey = await window.crypto.subtle.importKey(
        'pkcs8',
        keyBuffer,
        this.rsaAlgorithm,
        true,
        ['decrypt', 'sign']
      );
      return privateKey;
    } catch (error) {
      console.error('Failed to import private key:', error);
      throw error;
    }
  }

  // Open IndexedDB
  async openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('chatta-encryption', 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('keys')) {
          db.createObjectStore('keys', { keyPath: 'userId' });
        }
      };
    });
  }
}

// Create singleton instance
const encryption = new E2EEncryption();

export default encryption;
