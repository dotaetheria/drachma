import crypto from 'crypto';
import { secp256k1 } from '@noble/curves/secp256k1';
import { sha256 } from '@noble/hashes/sha256';

class DrachmaWallet {
    constructor() {
        this.accounts = new Map();
    }

    generateAccount() {
        // Generate private key (32 bytes)
        const privateKey = crypto.randomBytes(32);
        
        // Derive public key using secp256k1
        const publicKey = secp256k1.getPublicKey(privateKey);
        
        // Hash the public key and take last 10 bytes for address
        const hash = sha256(publicKey);
        const address = 'DRC' + Buffer.from(hash).slice(-10).toString('hex');
        
        // Store account (convert privateKey to hex for storage)
        this.accounts.set(address, {
            privateKey: privateKey.toString('hex'),
            balance: 0
        });

        return { 
            address, 
            privateKey: privateKey.toString('hex')
        };
    }

    listAccounts() {
        return Array.from(this.accounts.keys());
    }

    getAccount(address) {
        return this.accounts.get(address);
    }
}

// Playground
function playground() {
    console.log('🪙 Drachma Wallet Playground');
    console.log('----------------------------');

    const wallet = new DrachmaWallet();
    
    // Generate a few accounts
    console.log('\nGenerating accounts...');
    for (let i = 0; i < 3; i++) {
        const account = wallet.generateAccount();
        console.log(`\nAccount ${i + 1}:`);
        console.log(`Address: ${account.address}`);
        console.log(`Private Key: ${account.privateKey}`);
    }

    // List all accounts
    console.log('\nAll addresses:');
    wallet.listAccounts().forEach(address => {
        console.log(address);
    });
}

playground();
