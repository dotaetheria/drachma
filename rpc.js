const express = require('express');
const crypto = require('crypto');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors()); // Enable CORS for all routes
app.use(express.json());

// Mock Ethereum JSON-RPC Provider
class EthereumProvider {
    constructor() {
        // In-memory wallet storage
        this.wallets = {};

        // Predefined methods mapping
        this.methods = {
            'eth_accounts': this.eth_accounts.bind(this),
            'eth_requestAccounts': this.eth_requestAccounts.bind(this),
            'eth_getBalance': this.eth_getBalance.bind(this),
            'eth_sendTransaction': this.eth_sendTransaction.bind(this),
            'eth_blockNumber': this.eth_blockNumber.bind(this),
            'eth_chainId': this.eth_chainId.bind(this), // Return the Chain ID
            'net_version': this.net_version.bind(this), // Add net_version method
            'eth_getBlockByNumber': this.eth_getBlockByNumber.bind(this) // Add this line
        };

        this.blockNumber = 0; // Initialize block number
    }

    // Method to return the chain ID
    eth_chainId() {
        return '0x539'; // Hexadecimal representation of 1337
    }
    // Method to return block data by number
    eth_getBlockByNumber(blockNumber, fullTransactionObjects) {
        // You can implement a mock block structure here
        const blockData = {
            number: blockNumber, // The block number in hex
            hash: '0x' + crypto.randomBytes(32).toString('hex'), // Mock block hash
            transactions: [], // You can add mock transactions if necessary
            // Add more block data as needed
        };

        // If fullTransactionObjects is true, include transaction details
        if (fullTransactionObjects) {
            blockData.transactions = [/* ...mock transaction details... */];
        }

        return blockData;
    }

    // Method to return the block number in hex
    eth_blockNumber() {
        console.log(`Returning block number: ${this.blockNumber}, ` + '0x' + this.blockNumber.toString(16));
        return '0x' + this.blockNumber.toString(16); // Convert to hex
    }

    // Method to return the network version
    net_version() {
        return '1337'; // Return the network ID as a string
    }

    // MetaMask method: eth_accounts - Return available accounts
    eth_accounts() {
        return Object.keys(this.wallets);
    }

    // MetaMask method: eth_requestAccounts - Request and return wallet accounts
    eth_requestAccounts() {
        if (Object.keys(this.wallets).length === 0) {
            const newAddress = this.generateAddress();
            this.wallets[newAddress] = {
                balance: '0x1A4', // Hex for 420 
                nonce: 0
            };
            return [newAddress];
        }
        return Object.keys(this.wallets);
    }

    // MetaMask method: eth_getBalance - Return balance in hex
    eth_getBalance(address) {
        const wallet = this.wallets[address];
        if (!wallet) {
            throw new Error('Account not found');
        }
        return wallet.balance; // Already in hex
    }

    // MetaMask method: eth_sendTransaction - Simulate transaction
    eth_sendTransaction(transaction) {
        const { from, to, value } = transaction;

        // Validate sender has funds
        const senderWallet = this.wallets[from];
        if (!senderWallet) {
            throw new Error('Sender account not found');
        }

        // Ensure recipient wallet exists
        if (!this.wallets[to]) {
            this.wallets[to] = {
                balance: '0x0',
                nonce: 0
            };
        }

        // Increment nonce
        senderWallet.nonce += 1;

        // Return transaction hash
        return '0x' + crypto.randomBytes(32).toString('hex');
    }

    // Generate a wallet address
    generateAddress() {
        return '0x' + crypto.randomBytes(20).toString('hex');
    }

    // Handle JSON-RPC request
    handleRequest(method, params) {
        if (!this.methods[method]) {
            throw new Error(`Method not found: ${method}`);
        }

        return this.methods[method](...params);
    }
}

const provider = new EthereumProvider();

// Single JSON-RPC endpoint
app.post('/metamask', (req, res) => {
    try {
        const { method, params = [] } = req.body;

        console.log(`Received RPC request: ${method}`);

        const result = provider.handleRequest(method, params);

        res.json({
            jsonrpc: '2.0',
            id: req.body.id || null,
            result
        });
    } catch (error) {
        res.status(400).json({
            jsonrpc: '2.0',
            id: req.body.id || null,
            error: {
                code: -32600,
                message: error.message
            }
        });
    }
});

app.listen(PORT, () => {
    console.log(`MetaMask JSON-RPC Provider running on port ${PORT}`);
});

module.exports = app;
