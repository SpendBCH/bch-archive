let appSettings = require('./appsettings')

let BITBOXCli = require('bitbox-cli/lib/bitboxcli').default
let BITBOX = new BITBOXCli(appSettings.bitbox)

let Twitter = require('twitter')
let twitter = new Twitter(appSettings.twitter.keys)

let redis = require("redis")
let redisClient = redis.createClient()
const {promisify} = require('util');
const getRedisAsync = promisify(redisClient.get).bind(redisClient);

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

let main = async () => {
    // Init memoWallet from cache if available else appsettings
    let memoWallet
    let memoWalletResponse = await getRedisAsync("memoWallet")
    if (!memoWalletResponse) {
        memoWallet = { ...appSettings.memo.wallet }
        redisClient.set("memoWallet", JSON.stringify(memoWallet))
    } else {
        memoWallet = JSON.parse(memoWalletResponse)
    }

    // Init sinceId from cache if available else appsettings
    let sinceId
    let sinceIdResponse = await getRedisAsync("sinceId")
    if (!sinceIdResponse) {
        sinceId = appSettings.twitter.sinceId
        redisClient.set("sinceId", sinceId)
    } else {
        sinceId = sinceIdResponse
    }

    let tweets = await getTweets(sinceId)

    for (let tweet of tweets) {
        if (tweet.id == sinceId)
            continue

        await sendMemoFromTweet(memoWallet, tweet.full_text)
        sinceId = tweet.id
        redisClient.set("sinceId", sinceId)

        await sleep(60 * 1000)
    }

    // Sleep then check for new tweets
    setTimeout(main, appSettings.pollIntervalSeconds * 1000)
}

let getTweets = async (sinceId) => {
    try {
        let params = {
            screen_name: appSettings.twitter.screenName, 
            tweet_mode:'extended',
            exclude_replies: true, 
            trim_user: true, 
            since_id: sinceId
        }

        let tweets = await twitter.get('statuses/user_timeline', params)

        // Sort tweets by id as they come in unordered
        tweets.sort((a, b) => a.id - b.id)

        return tweets
    } catch (ex) {
        console.log(ex)
        return []
    }
}

let convertTweetToMemos = (tweet) => {
    let maxLength = appSettings.memo.maxMemoLength
    let numBytes = Buffer.byteLength(tweet)

    let memos = []
    if (Buffer.from(tweet).length < maxLength) {
        memos.push(tweet)
    } else { // Split into multiple memos
        // TODO: Split on any utf8 whitespace & preserve original whitespace
        let tokens = tweet.split(" ")

        let memo = "1/"
        for (let token of tokens) {
            if (Buffer.from(`${memo} ${token}`).length < maxLength) {
                memo = `${memo} ${token}`
            }
            else if (memo.length > 2) { 
                memos.push(memo.slice())
                memo = `${memos.length + 1}/`
            } else { 
                console.log("Could not split tweet: ", tweet)
                return []
            }
        }
        memos.push(memo.slice())
    }

    return memos
}

let createMemo = async (wallet, memo) => {
    return new Promise( (resolve, reject) => {
        let transactionBuilder = new BITBOX.TransactionBuilder('bitcoincash')
        transactionBuilder.addInput(wallet.txid, 0)

        // Create op return script for post memo
        let script = [BITBOX.Script.opcodes.OP_RETURN, Buffer.from('6d02', 'hex'), Buffer.from(memo)]
        let data = BITBOX.Script.encode(script)

        // Calculate fee @ 1 sat/byte
        let byteCount = BITBOX.BitcoinCash.getByteCount({ P2PKH: 1 }, { P2PKH: 2 }) + Buffer.byteLength(memo)
        let satoshisAfterFee = wallet.satoshis - byteCount

        // Send all change to memo address
        transactionBuilder.addOutput(wallet.address, satoshisAfterFee)
        transactionBuilder.addOutput(data, 0)

        let key = BITBOX.ECPair.fromWIF(wallet.wif)

        let redeemScript
        transactionBuilder.sign(0, key, redeemScript, transactionBuilder.hashTypes.SIGHASH_ALL, wallet.satoshis)

        let hex = transactionBuilder.build().toHex()
        BITBOX.RawTransactions.sendRawTransaction(hex).then((result) => { 
            console.log('txid:', result, 'satoshisAfterFee:', satoshisAfterFee)
            if (result.length < 60) // Very rought txid size check for failure
                reject("txid too small")
            else {
                wallet.txid = result
                wallet.satoshis = satoshisAfterFee
                redisClient.set("memoWallet", JSON.stringify(wallet))

                resolve()
            }
        }, (err) => { 
            console.log(err)
            reject(err)
        })
    })
}

let sendMemoFromTweet = async (wallet, tweet) => {
    return new Promise( async (resolve, reject) => {
        try {
            let memos = convertTweetToMemos(tweet)
            for (let memo of memos) {
                await createMemo(wallet, memo)
            }
        } catch (ex) {
            console.log("error sendMemoFromTweet:", ex)
        }

        resolve()
    })
}

// Launch app
main()
