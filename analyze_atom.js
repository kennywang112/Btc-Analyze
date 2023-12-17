import { ElectrumApi, detectAddressTypeToScripthash, Atomicals } from 'atomicals-js';

const atomicals = new Atomicals(ElectrumApi.createClient("https://ep.atomicals.xyz/proxy"));
const state = await atomicals.getAtomicalState('6341fdaf0ef212ed3d4344a73df44389950442d753dc851b423ed9f541fd9a04i0', true);
console.log(state.data.result.state.latest);

// const collection = await atomicals.getAtomicalByRealm("toothy", true);
// console.log(collection)

// const collection = await atomicals.getRealmInfo("toothy", true, true);
// console.log(collection)

// const state = await atomicals.getContainerItems('9298f1458a05cead0dc279f7638251dfe837fda1f9a66b340e4e523a0850baf1i0', true);
// console.log(state)

const tx = await atomicals.getTx("1618118775062c3873d9f85ea4db708317f56bb100e086f1749945f6e8c562b5")
console.log(tx)