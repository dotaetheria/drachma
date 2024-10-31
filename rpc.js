const express = require('express');
const crypto = require('crypto');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Enhanced CORS configuration
app.use(cors({
    origin: '*',
    methods: ['POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type']
}));

app.use(express.json());

class EthereumProvider {
    constructor() {
        this.wallets = {};
        this.blockNumber = 0;
        this.methods = {
            'eth_accounts': this.eth_accounts.bind(this),
            'eth_requestAccounts': this.eth_requestAccounts.bind(this),
            'eth_getBalance': this.eth_getBalance.bind(this),
            'eth_sendTransaction': this.eth_sendTransaction.bind(this),
            'eth_blockNumber': this.eth_blockNumber.bind(this),
            'eth_chainId': this.eth_chainId.bind(this),
            'net_version': this.net_version.bind(this),
            'eth_getBlockByNumber': this.eth_getBlockByNumber.bind(this)
        };

        // Start block number incrementing
        setInterval(() => {
            this.blockNumber++;
        }, 10000); // New block every 10 seconds
    }

    eth_chainId() {
        return '0x539';
    }

    eth_getBlockByNumber(blockNumber, fullTransactionObjects) {
        const blockNumHex = typeof blockNumber === 'string' ? 
            blockNumber : 
            '0x' + this.blockNumber.toString(16);

        return {
            number: blockNumHex,
            hash: '0x' + crypto.randomBytes(32).toString('hex'),
            parentHash: '0x' + crypto.randomBytes(32).toString('hex'),
            timestamp: '0x' + Math.floor(Date.now() / 1000).toString(16),
            transactions: fullTransactionObjects ? [] : [],
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

    eth_blockNumber() {
        const hexBlock = '0x' + this.blockNumber.toString(16);
        console.log(`Returning block number: ${this.blockNumber} - (${hexBlock})`);
        return hexBlock;
    }

    net_version() {
        return '1337';
    }

    eth_accounts() {
        const accounts = Object.keys(this.wallets);
        if (accounts.length === 0) {
            return [];
        }
        return accounts;
    }

    eth_requestAccounts() {
        if (Object.keys(this.wallets).length === 0) {
            const newAddress = this.generateAddress();
            this.wallets[newAddress] = {
                balance: '0x' + (1e18).toString(16), // 1 ETH
                nonce: 0
            };
            return [newAddress];
        }
        return Object.keys(this.wallets);
    }

    eth_getBalance(address) {
        const wallet = this.wallets[address];
        if (!wallet) {
            return '0x0';
        }
        return wallet.balance;
    }

    eth_sendTransaction(transaction) {
        const { from, to, value } = transaction;
        
        if (!this.wallets[from]) {
            throw new Error('Sender account not found');
        }

        if (!this.wallets[to]) {
            this.wallets[to] = { balance: '0x0', nonce: 0 };
        }

        this.wallets[from].nonce++;
        return '0x' + crypto.randomBytes(32).toString('hex');
    }

    generateAddress() {
        return '0x' + crypto.randomBytes(20).toString('hex');
    }

    handleRequest(method, params) {
        console.log(`Handling method: ${method} with params:`, params);
        
        if (!this.methods[method]) {
            throw new Error(`Method ${method} not supported`);
        }

        return this.methods[method](...(Array.isArray(params) ? params : []));
    }
}

const provider = new EthereumProvider();

// Handle OPTIONS requests explicitly
app.options('/metamask', (req, res) => {
    res.sendStatus(200);
});

app.post('/metamask', (req, res) => {
    try {
        if (!req.body || !req.body.method) {
            throw new Error('Invalid JSON-RPC request');
        }

        const { method, params = [], id } = req.body;
        console.log(`Received RPC request: ${method}`);

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
    console.log(`MetaMask JSON-RPC Provider running on port ${PORT}`);
});

module.exports = app;
