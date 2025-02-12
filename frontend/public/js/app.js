let web3;
let registrationContract;
let tokenContract;
let userAccount;

async function setupHardhatNetwork() {
    try {
        await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x7A69' }], // 31337 in hex
        });
    } catch (switchError) {
        if (switchError.code === 4902) {
            try {
                await window.ethereum.request({
                    method: 'wallet_addEthereumChain',
                    params: [
                        {
                            chainId: '0x7A69',
                            chainName: 'Hardhat Local',
                            rpcUrls: ['http://127.0.0.1:8545'],
                            nativeCurrency: {
                                name: 'ETH',
                                symbol: 'ETH',
                                decimals: 18
                            }
                        }
                    ],
                });
            } catch (addError) {
                console.error('Error adding Hardhat network:', addError);
            }
        }
    }
}

async function connectWallet() {
    if (typeof window.ethereum !== 'undefined') {
        try {
            await setupHardhatNetwork();
            
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            userAccount = accounts[0];

            web3 = new Web3(window.ethereum);

            updateUI('success', `Wallet connected: ${userAccount.substring(0, 6)}...${userAccount.substring(38)}`);
            document.getElementById('connect-wallet').disabled = true;
            document.getElementById('approve-token').disabled = false;
        } catch (error) {
            console.error('Error connecting to wallet:', error);
            updateUI('danger', 'Error connecting to wallet. Please try again.');
        }
    } else {
        updateUI('danger', 'Please install MetaMask to register!');
    }
}

async function approveToken() {
    try {
        document.getElementById('approve-token').disabled = true;
        updateUI('info', 'Approving token...');

        if (CONFIG.REGISTRATION_CONTRACT_ADDRESS == '') {
            updateUI('danger', 'Contract address not set in the config.js file');
            return;
        }

        registrationContract = new web3.eth.Contract(CONFIG.REGISTRATION_CONTRACT_ABI, CONFIG.REGISTRATION_CONTRACT_ADDRESS);
        
        if (!registrationContract) {
            updateUI('danger', 'Contract not deployed yet');
            return;
        }

        const tokenAddress = await registrationContract.methods.token().call();
        tokenContract = new web3.eth.Contract(CONFIG.ERC20_ABI, tokenAddress);
        
        console.log(tokenContract);
        const registrationType = document.getElementById('registration-type').value;
        const fee = await registrationContract.methods.registrationFeeType(registrationType).call();
        
        // Approve the token contract to spend the fee
        await tokenContract.methods.approve(CONFIG.REGISTRATION_CONTRACT_ADDRESS, fee).send({
            from: userAccount
        });
        
        updateUI('success', 'Token approved! You can now register.');
        document.getElementById('register-button').disabled = false;
    } catch (error) {
        console.error('Error approving token:', error);
        document.getElementById('approve-token').disabled = false;
        updateUI('danger', 'Error approving token. Please try again.');
    }
}

async function handleRegistration(event) {
    event.preventDefault();
    
    const formData = {
        name: document.getElementById('name').value,
        registrationType: document.getElementById('registration-type').value,
        affiliation: document.getElementById('affiliation').value,
        email: document.getElementById('email').value
    };
    
    try {
        document.getElementById('register-button').disabled = true;
        
        // TODO: Check if the wallet is already registered
        const isRegistered = await registrationContract.methods.isRegistered(userAccount).call();
        
        if (isRegistered) {           
            updateUI('warning', 'This wallet is already registered');
            document.getElementById('approve-token').disabled = true;
            document.getElementById('register-button').disabled = false;
            return;
        }
        
        updateUI('info', 'Registering...');
        
        // TODO: Register the current user
        await registrationContract.methods.register(formData.registrationType).send({
            from: userAccount
        });
        
        updateUI('success', 'Registration successful!');
        
    } catch (error) {
        console.error('Error during registration:', error);
        document.getElementById('register-button').disabled = false;
        updateUI('danger', 'Error during registration. Please try again.');
    }
}

function updateUI(type, message) {
    const statusElement = document.getElementById('wallet-status');
    statusElement.className = `alert alert-${type} mb-4`;
    statusElement.textContent = message;
}

// Event Listeners
document.getElementById('connect-wallet').addEventListener('click', connectWallet);
document.getElementById('approve-token').addEventListener('click', approveToken);
document.getElementById('registration-form').addEventListener('submit', handleRegistration);

// MetaMask Events
if (window.ethereum) {
    window.ethereum.on('accountsChanged', () => window.location.reload());
    window.ethereum.on('chainChanged', () => window.location.reload());
}
