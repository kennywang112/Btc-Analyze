import mempoolJS from '@mempool/mempool.js';

const { bitcoin, bisq, liquid } = mempoolJS({
    hostname: 'mempool.space', 
    network: 'mainnet' // 'signet' | 'testnet' | 'mainnet'
});

const address = 'bc1pw024mk00s8u5psewxc0d0tevhrq3pe6jk84nj6sqhft652zutvwq87a2mp';

const myAddress = await bitcoin.addresses.getAddressTxs({ address });
console.log(myAddress[0]);