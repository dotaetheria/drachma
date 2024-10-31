const express = require('express');
const crypto = require('crypto');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS configuration
app.use(cors());
app.use(express.json());

// Constants for network configuration
const CHAIN_ID = '0x539';  // 1337 in hex
const NETWORK_ID = '1337';

class EthereumProvider {
    constructor() {
        this.dataFile = path.join(__dirname, 'ethereum-state.json');
        this.loadState();
        
        this.methods = {
            'eth_chainId': this.eth_chainId.bind(this),
            'net_version': this.net_version.bind(this),
            'eth_accounts': this.eth_accounts.bind(this),
            'eth_requestAccounts': this.eth_requestAccounts.bind(this),
            'eth_getBalance': this.eth_getBalance.bind(this),
            'eth_sendTransaction': this.eth_sendTransaction.bind(this),
            'eth_blockNumber': this.eth_blockNumber.bind(this),
            'eth_getBlockByNumber': this.eth_getBlockByNumber.bind(this),
            'net_listening': this.net_listening.bind(this),
            'eth_syncing': this.eth_syncing.bind(this),
            'eth_getTransactionCount': this.eth_getTransactionCount.bind(this),
            'eth_estimateGas': this.eth_estimateGas.bind(this),
        };

        // Start block incrementing
        setInterval(() => {
            this.state.blockNumber++;
            this.saveState();
        }, 10000);
    }

    loadState() {
        try {
            if (fs.existsSync(this.dataFile)) {
                const data = fs.readFileSync(this.dataFile, 'utf8');
                this.state = JSON.parse(data);
            } else {
                this.state = {
                    wallets: {},
                    blockNumber: 36,  // Set initial block number to 36
                    transactions: []
                };
                this.saveState();
            }
            console.log("Loaded state:", this.state); // Log loaded state
        } catch (error) {
            console.error('Error loading state:', error);
            this.state = {
                wallets: {},
                blockNumber: 36,
                transactions: []
            };
        }
    }

    saveState() {
        try {
            fs.writeFileSync(this.dataFile, JSON.stringify(this.state, null, 2));
        } catch (error) {
            console.error('Error saving state:', error);
        }
    }

    eth_chainId() {
        console.log('Returning chain ID:', CHAIN_ID);
        return CHAIN_ID;
    }

    net_version() {
        console.log('Returning network ID:', NETWORK_ID);
        return NETWORK_ID;
    }

    net_listening() {
        return true;
    }

    eth_syncing() {
        return false;
    }

    eth_blockNumber() {
        const hexBlock = '0x' + this.state.blockNumber.toString(16);
        return hexBlock;
    }

    eth_getTransactionCount(address) {
        const wallet = this.state.wallets[address];
        return wallet ? '0x' + wallet.nonce.toString(16) : '0x0';
    }

    eth_estimateGas() {
        return '0x5208'; // 21000 gas
    }

    eth_accounts() {
        return Object.keys(this.state.wallets);
    }

    eth_requestAccounts() {
        if (Object.keys(this.state.wallets).length === 0) {
            const newAddress = this.generateAddress();
            // Initialize the wallet with a balance of 420
            this.state.wallets[newAddress] = {
                balance: '0x' + (420).toString(16), // Set balance to 420 in hex
                nonce: 0
            };
            this.saveState();
            console.log("New account created:", newAddress, "with balance:", this.state.wallets[newAddress].balance); // Log new account
            return [newAddress];
        }
        return Object.keys(this.state.wallets);
    }

    eth_getBalance(address) {
        const wallet = this.state.wallets[address];
        console.log("Checking balance for address:", address); // Log the address being checked
        // If the wallet does not exist, return a balance of 0
        if (!wallet) {
            console.log("Wallet does not exist. Returning balance 0x0"); // Log non-existent wallet
            return '0x0';
        }
        console.log("Balance for address", address, "is", wallet.balance); // Log found balance
        return wallet.balance; // Return existing wallet balance
    }

    eth_sendTransaction(transaction) {
        const { from, to, value } = transaction;
        
        if (!this.state.wallets[from]) {
            throw new Error('Sender account not found');
        }

        if (!this.state.wallets[to]) {
            this.state.wallets[to] = { balance: '0x' + (420).toString(16), nonce: 0 }; // Initialize with balance 420
            console.log("New wallet created for recipient:", to, "with balance:", this.state.wallets[to].balance); // Log recipient account
        }

        this.state.wallets[from].nonce++;
        
        const txHash = '0x' + crypto.randomBytes(32).toString('hex');
        this.state.transactions.push({
            hash: txHash,
            from,
            to,
            value,
            blockNumber: this.eth_blockNumber(),
            timestamp: Date.now()
        });

        this.saveState();
        return txHash;
    }

    eth_getBlockByNumber(blockNumber, fullTransactionObjects) {
        return {
            number: blockNumber,
            hash: '0x' + crypto.randomBytes(32).toString('hex'),
            parentHash: '0x' + crypto.randomBytes(32).toString('hex'),
            timestamp: '0x' + Math.floor(Date.now() / 1000).toString(16),
            transactions: fullTransactionObjects ? this.state.transactions : [],
            gasLimit: '0x6691b7',
            gasUsed: '0x0',
            miner: '0x' + crypto.randomBytes(20).toString('hex'),
            difficulty: '0x0',
            totalDifficulty: '0x0',
            extraData: '0x',
            size: '0x0',
            nonce: '0x' + crypto.randomBytes(8).toString('hex')
        };
    }

    generateAddress() {
        return '0x' + crypto.randomBytes(20).toString('hex');
    }

    handleRequest(method, params = []) {
        console.log(`Handling RPC request: ${method}`, params);
        
        if (!this.methods[method]) {
            throw new Error(`Method ${method} not supported`);
        }

        const result = this.methods[method](...params);
        console.log(`RPC response for ${method}:`, result);
        return result;
    }
}

const provider = new EthereumProvider();

// Pre-flight request handling
app.options('/metamask', (req, res) => {
    res.sendStatus(200);
});

// Main RPC endpoint
app.post('/metamask', (req, res) => {
    try {
        const { method, params = [], id } = req.body;
        
        if (!method) {
            throw new Error('Invalid JSON-RPC request');
        }

        const result = provider.handleRequest(method, params);

        res.json({
            jsonrpc: '2.0',
            id: id || null,
            result
        });
    } catch (error) {
        console.error('RPC Error:', error.message);
        res.json({
            jsonrpc: '2.0',
            id: req.body.id || null,
            error: {
                code: -32000,
                message: error.message
            }
        });
    }
});

app.listen(PORT, () => {
    console.log(`MetaMask RPC Provider running on http://localhost:${PORT}/metamask`);
    console.log(`Chain ID: ${CHAIN_ID} (${parseInt(CHAIN_ID, 16)})`);
    console.log(`Network ID: ${NETWORK_ID}`);
});

module.exports = app;
