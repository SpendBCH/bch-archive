module.exports = {
    bitbox: { // Connection details for a BCH node with RPC access
        protocol: 'http',
        host: '127.0.0.1',
        port: 8332,
        username: '',
        password: '',
        corsproxy: false,
    },
    twitter: {
        keys: { // Create a new app on twitter to get your keys
                consumer_key: '',
                consumer_secret: '',
                access_token_key: '',
                access_token_secret: ''
        },
        screenName: '', // Twitter username to bridge
        sinceId: 1, // Set to 1 to start as far back as twitter api allows (basic api allows ~20)
    },
    memo: {
        wallet: { // Initial wallet info for memo account; updated in cache; change redisPrefix to init again
            address: 'bitcoincash:',
            wif: '', // Compressed base58 format
            txid: "", // Txid of current memo utxo
            voutIndex: 0, // Vout index of current memo utxo
            satoshis: 0, // Satoshis available in current memo utxo
        },
        maxMemoLength: 216, // Max length of a post based on op return
    },
    pollIntervalSeconds: 10 * 60, // ex: 10 minutes * 60 seconds = 600 seconds = 10 minutes
}
