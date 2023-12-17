import mempoolJS from '@mempool/mempool.js';
// import { Series, DataFrame } from 'pandas-js';
import fs from 'fs';

const { bitcoin, bisq, liquid } = mempoolJS({
    hostname: 'mempool.space', 
    network: 'mainnet' // 'signet' | 'testnet' | 'mainnet'
});

const address = 'bc1pw024mk00s8u5psewxc0d0tevhrq3pe6jk84nj6sqhft652zutvwq87a2mp';

const myAddress = await bitcoin.addresses.getAddressTxs({ address });
const allTxids = myAddress.map(tx => tx.txid);
// console.log("All txs:", allTxids)
// console.log(myAddress)

const txData = myAddress.map(tx => ({
  txid: tx.txid,
  version: tx.version,
  locktime: tx.locktime,
  size: tx.size,
  weight: tx.weight,
  fee: tx.fee,
  confirmed: tx.status.confirmed,
  block_height: tx.status.block_height,
  block_hash: tx.status.block_hash,
  block_time: tx.status.block_time,
}));
// console.log(txData);

// const df = DataFrame(txData);
// console.log(df);

// console.log(myAddress[0].txid)

const vout_data = myAddress.map(tx => tx.vout);
// first tx
const vin = myAddress[0].vin;
const vout= myAddress[0].vout;
// first index data: txid/address/value
// console.log(vin[0].txid)
// console.log(vin[0].prevout.scriptpubkey_address)
// console.log(vin[0].prevout.value)

// vin info of first tx
const firstTx_in = vin.map(tx => ({
  vin_tx: tx.txid,
  vin_address: tx.prevout.scriptpubkey_address,
  vin_value: tx.prevout.value
}))
// console.log(firstTx_in)

const allVinData = [];
const allVoutData = [];
for (let i = 0; i < myAddress.length; i++) {
  const tx = myAddress[i];
  const vin = tx.vin;
  const vout = tx.vout;

  const vinData = vin.map(vinTx => ({
    tx_index: i, // index
    vin_tx: vinTx.txid,
    vin_address: vinTx.prevout.scriptpubkey_address,
    vin_value: vinTx.prevout.value,
  }));
  const voutData = vout.map(voutTx => ({
    tx_index: i,
    vout_address: voutTx.scriptpubkey_address,
    vout_value: voutTx.value,
  }));

  allVinData.push(...vinData);
  allVoutData.push(...voutData);
}
// console.log("vin data:", allVinData)
// console.log("vout data:", allVoutData)

// const v_data = myAddress.map(tx => ({
//   vin_tx: tx.txid,
//   vin_address: tx.vin[0].prevout.scriptpubkey_address,
//   vin_value: tx.vin[0].prevout.value,
//   // vout: tx.vout
// }));
// console.log(v_data)

const txJsonString = JSON.stringify(txData, null, 2);
const txFilePath = 'output/txData.json';
fs.writeFileSync(txFilePath, txJsonString);

const vinJsonString = JSON.stringify(allVinData, null, 2);
const vinFilePath = 'output/allVinData.json';
fs.writeFileSync(vinFilePath, vinJsonString);

const voutJsonString = JSON.stringify(allVoutData, null, 2);
const voutFilePath = 'output/allVoutData.json';
fs.writeFileSync(voutFilePath, voutJsonString);

const fullJsonString = JSON.stringify(myAddress, null, 2);
const fullFilePath = 'output/myAddress.json';
fs.writeFileSync(fullFilePath, fullJsonString);