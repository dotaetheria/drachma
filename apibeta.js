const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Sequelize, DataTypes } = require('sequelize');
const { verifyMessage } = require('ethers');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Sequelize with SQLite
const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: 'database.sqlite', // Specify your SQLite database file
});

// Define the Account model
const Account = sequelize.define('Account', {
    publicKey: {
        type: DataTypes.STRING,
        primaryKey: true,
    },
    points: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
    }
});

// Define the PaymentRequest model
const PaymentRequest = sequelize.define('PaymentRequest', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    creditorKey: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    debtorKey: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    amount: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    status: {
        type: DataTypes.ENUM('pending', 'approved', 'rejected'),
        defaultValue: 'pending',
    },
});



// Admin key (store securely in production)
const ADMIN_KEY = '12345'; // Replace with your secure key

app.use(cors());
app.use(bodyParser.json());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Sync the database
sequelize.sync()
    .then(() => {
        console.log('Database & tables created!');
    })
    .catch(error => console.error('Error creating database:', error));

// Endpoint to mint points (admin only)
app.post('/api/mint', async (req, res) => {
    const { adminKey, publicKey, points } = req.body;

    // Check if the provided admin key is correct
    if (adminKey !== ADMIN_KEY) {
        return res.status(403).send('Forbidden: Invalid admin key.');
    }

    // Check if the public key is provided
    if (!publicKey) {
        return res.status(400).send('Bad Request: Public key is required.');
    }

    try {
        // Find or create the account
        const [account, created] = await Account.findOrCreate({
            where: { publicKey },
            defaults: { points },
        });

        if (!created) {
            // Account exists, update points
            account.points += points;
            await account.save();
        }

        res.status(200).send('Points minted successfully.');
    } catch (error) {
        console.error('Error minting points:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Endpoint to get points for a user
app.get('/api/getPoints', async (req, res) => {
    const { publicKey } = req.query;

    // Check if the public key is provided
    if (!publicKey) {
        return res.status(400).send('Bad Request: Public key is required.');
    }

    try {
        const account = await Account.findByPk(publicKey);
        if (account) {
            return res.status(200).json({ points: account.points });
        } else {
            return res.status(200).send({ points: 0 });
        }
    } catch (error) {
        console.error('Error retrieving points:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Endpoint to transfer points
app.get('/api/transfer', async (req, res) => {
    const { publicKey, recipientPublicKey, amount, sign } = req.query;

    // Check if the public key is provided
    if (!publicKey) {
        return res.status(400).send('Bad Request: Public key is required.');
    }

    try {
        const account = await Account.findByPk(publicKey);
        if (account) {
            if (account.points >= amount) {
                // Verify the signature
                const message = `Transfer ${amount} points to ${recipientPublicKey}`;
                const signerAddress = verifyMessage(message, sign);

                if (signerAddress.toLowerCase() === publicKey.toLowerCase()) {
                    const recipientAccount = await Account.findByPk(recipientPublicKey) || await Account.create({ publicKey: recipientPublicKey });
                    recipientAccount.points += parseInt(amount); // Increment points
                    await recipientAccount.save();

                    account.points -= amount;
                    await account.save();

                    return res.status(200).send('Transfer successful.');
                } else {
                    return res.status(403).send('Forbidden: Invalid signature.');
                }
            } else {
                return res.status(400).send('You do not have enough money.');
            }
        } else {
            return res.status(400).send('Account not found.');
        }
    } catch (error) {
        console.error('Error transferring points:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Endpoint for creditor to request payment from debtor
app.get('/api/payment/request', async (req, res) => {
    const { kreditorKey, debitorKey, amount, sign } = req.query; // Now requires amount

    // Check if the required keys are provided
    if (!kreditorKey || !debitorKey || !amount) {
        return res.status(400).send('Bad Request: Creditor key, debtor key, and amount are required.');
    }

    try {
        // Verify the signature
        const message = `Request payment of ${amount} from ${debitorKey}`;
        const signerAddress = verifyMessage(message, sign);

        // Check if the signer's address matches the creditor's key
        if (signerAddress.toLowerCase() !== kreditorKey.toLowerCase()) {
            return res.status(403).send('Forbidden: Invalid signature.' + signerAddress);
        }

        // Create a new payment request
        const paymentRequest = await PaymentRequest.create({
            creditorKey: kreditorKey,
            debtorKey: debitorKey,
            amount: parseInt(amount), // Ensure the amount is an integer
            status: 'pending',
        });

        return res.status(200).json({ message: 'Payment request sent successfully.', paymentRequest });
    } catch (error) {
        console.error('Error requesting payment:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Endpoint for accepting the payment request and sending the money (using the transaction function)
app.get('/api/payment/accept', async (req, res) => {
    const { requestId, sign, publicKey } = req.query;
    let id = requestId;
    // Check if the required keys are provided
    if (!id || !sign) {
        return res.status(400).send('Bad Request: ID and signature are required.' + JSON.stringify(req.query));
    }

    try {
        // Verify the signature
        const message = `Accept payment request ${id}`;
        const signerAddress = verifyMessage(message, sign);
        console.log('SID' + signerAddress);



        // Check if the signer's address matches the creditor's key
        if (signerAddress.toLowerCase() !== publicKey.toLowerCase()) {
            return res.status(403).send('Forbidden: Invalid signature.' + signerAddress);
        }

        const paymentRequest = await PaymentRequest.findByPk(id);
        
        if (!paymentRequest) {
            return res.status(404).send('Payment request not found.');
        }

        if (paymentRequest.status === 'accepted') {
            return res.status(400).send('Payment request already accepted.');
        }

        const debitorAccount = await Account.findByPk(publicKey);
        if (debitorAccount.points < paymentRequest.amount) {
            return res.status(404).send('Insufficent points.');
        }

        // Accept the payment request
        paymentRequest.status = 'accepted';

        const creditorAccount = await Account.findByPk(paymentRequest.creditorKey);
        if (!creditorAccount) {
            return res.status(404).send('Creditor account not found.');
        }

        const debtorAccount = await Account.findByPk(paymentRequest.debtorKey);
        if (!debtorAccount) {
            return res.status(404).send('Debtor account not found.');
        }
        
        creditorAccount.points += parseInt(paymentRequest.amount); // Increment points
        await creditorAccount.save();

        debtorAccount.points -= parseInt(paymentRequest.amount);
        await debtorAccount.save();

        await paymentRequest.save();

        return res.status(200).send('Payment request accepted successfully.');
    } catch (error) {
        console.error('Error accepting payment:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.use((req, res, next) => {
    if (req.url !== '/metamask') {
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    }
    next(); // Call the next middleware or route handler
});


// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
