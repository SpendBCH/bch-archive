# bch-archive
## memo-twitter-bridge
Monitor twitter activity of a user to post to memo
### Setup
1. Setup redis on localhost w/default settings
1. Setup a Bitcoin Cash node with RPC access (configure in appsettings.js)
1. Set twitter keys and desired screenName to monitor in appsettings.js
1. Create memo account and set wif, txid, and satoshis in appsettings.js
1. node twitter-memo-bridge.js
