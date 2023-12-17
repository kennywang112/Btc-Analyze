"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AtomicalOperationBuilder = exports.REQUEST_NAME_TYPE = exports.REALM_CLAIM_TYPE = void 0;
const address_keypair_path_1 = require("./address-keypair-path");
const atomical_format_helpers_1 = require("./atomical-format-helpers");
const ecc = require("tiny-secp256k1");
const ecpair_1 = require("ecpair");
const tinysecp = require('tiny-secp256k1');
const bitcoin = require('bitcoinjs-lib');
const chalk = require("chalk");
bitcoin.initEccLib(ecc);
const bitcoinjs_lib_1 = require("bitcoinjs-lib");
(0, bitcoinjs_lib_1.initEccLib)(tinysecp);
const command_helpers_1 = require("../commands/command-helpers");
const select_funding_utxo_1 = require("./select-funding-utxo");
const utils_1 = require("./utils");
const witness_stack_to_script_witness_1 = require("../commands/witness_stack_to_script_witness");
const ECPair = (0, ecpair_1.ECPairFactory)(tinysecp);
const DEFAULT_SATS_BYTE = 10;
const DEFAULT_SATS_ATOMICAL_UTXO = 1000;
const SEND_RETRY_SLEEP_SECONDS = 15;
const SEND_RETRY_ATTEMPTS = 20;
const DUST_AMOUNT = 546;
const BASE_BYTES = 10.5;
const INPUT_BYTES_BASE = 57.5;
const OUTPUT_BYTES_BASE = 43;
const EXCESSIVE_FEE_LIMIT = 500000; // Limit to 1/200 of a BTC for now
var REALM_CLAIM_TYPE;
(function (REALM_CLAIM_TYPE) {
    REALM_CLAIM_TYPE["DIRECT"] = "direct";
    REALM_CLAIM_TYPE["RULE"] = "rule";
})(REALM_CLAIM_TYPE = exports.REALM_CLAIM_TYPE || (exports.REALM_CLAIM_TYPE = {}));
function logMiningProgressToConsole(dowork, disableMiningChalk, txid, nonces) {
    if (!dowork) {
        return;
    }
    if (disableMiningChalk) {
        if (nonces % 10000 === 0) {
            console.log('Generated nonces: ', nonces, ', time: ', Math.floor(Date.now() / 1000));
        }
        return;
    }
    process.stdout.clearLine(0);
    process.stdout.cursorTo(0);
    process.stdout.write(chalk.red(txid, ' nonces: ', nonces));
}
function printBitworkLog(bitworkInfo, commit) {
    if (!bitworkInfo) {
        return;
    }
    console.log(`\nAtomicals Bitwork Mining - Requested bitwork proof-of-work mining for the ${commit ? 'commit' : 'reveal'} transaction.`);
    if (commit) {
        console.log(`bitworkc (input): ${bitworkInfo.input_bitwork}`);
        console.log(`bitworkc (decoded): ${bitworkInfo.hex_bitwork}`);
    }
    else {
        console.log(`bitworkr (input): ${bitworkInfo.input_bitwork}`);
        console.log(`bitworkr (decoded): ${bitworkInfo.hex_bitwork}`);
    }
    console.log(`---------\nWARNING: This might take a very long time depending on the speed of the CPU.`);
    console.log(`Time to mine estimates: `);
    console.log(`- prefix length <= 4: about a minute or two. ~65,536 hashes on average.`);
    console.log(`- prefix length 5: several minutes. ~1,048,576 hashes on average.`);
    console.log(`- prefix length 6: up to an hour or more. ~16,777,216 hashes on average.`);
    console.log(`- prefix length >= 7: a few hours or much longer. >268,435,456 hashes on average.`);
    console.log(`\nStarting mining now...\n`);
}
var REQUEST_NAME_TYPE;
(function (REQUEST_NAME_TYPE) {
    REQUEST_NAME_TYPE["NONE"] = "NONE";
    REQUEST_NAME_TYPE["CONTAINER"] = "CONTAINER";
    REQUEST_NAME_TYPE["TICKER"] = "TICKER";
    REQUEST_NAME_TYPE["REALM"] = "REALM";
    REQUEST_NAME_TYPE["SUBREALM"] = "SUBREALM";
    REQUEST_NAME_TYPE["ITEM"] = "ITEM";
})(REQUEST_NAME_TYPE = exports.REQUEST_NAME_TYPE || (exports.REQUEST_NAME_TYPE = {}));
class AtomicalOperationBuilder {
    constructor(options) {
        this.options = options;
        this.userDefinedData = null;
        this.containerMembership = null;
        this.bitworkInfoCommit = null;
        this.bitworkInfoReveal = null;
        this.requestName = null;
        this.requestParentId = null;
        this.requestNameType = REQUEST_NAME_TYPE.NONE;
        this.meta = {};
        this.args = {};
        this.init = {};
        this.ctx = {};
        this.parentInputAtomical = null;
        this.inputUtxos = [];
        this.additionalOutputs = [];
        if (!this.options) {
            throw new Error('Options required');
        }
        if (!this.options.electrumApi) {
            throw new Error('electrumApi required');
        }
        if (!this.options.satsbyte) {
            this.options.satsbyte = DEFAULT_SATS_BYTE;
        }
        if (this.options.opType === 'nft') {
            if (!this.options.nftOptions) {
                throw new Error('nftOptions required for nft type');
            }
        }
        if (this.options.opType === 'ft') {
            if (!this.options.ftOptions) {
                throw new Error('ftOptions required for ft type');
            }
        }
        if (this.options.opType === 'dft') {
            if (!this.options.dftOptions) {
                throw new Error('dftOptions required for dft type');
            }
        }
        if (this.options.opType === 'dmt') {
            if (!this.options.dmtOptions) {
                throw new Error('dmtOptions required for dmt type');
            }
        }
    }
    setRBF(value) {
        this.options.rbf = value;
    }
    setRequestContainer(name) {
        if (this.options.opType !== 'nft') {
            throw new Error('setRequestContainer can only be set for NFT types');
        }
        const trimmed = name.startsWith('#') ? name.substring(1) : name;
        (0, atomical_format_helpers_1.isValidContainerName)(name);
        this.requestName = trimmed;
        this.requestNameType = REQUEST_NAME_TYPE.CONTAINER;
        this.requestParentId = null;
    }
    setRequestRealm(name) {
        if (this.options.opType !== 'nft') {
            throw new Error('setRequestRealm can only be set for NFT types');
        }
        const trimmed = name.startsWith('+') ? name.substring(1) : name;
        (0, atomical_format_helpers_1.isValidRealmName)(name);
        this.requestName = trimmed;
        this.requestNameType = REQUEST_NAME_TYPE.REALM;
        this.requestParentId = null;
    }
    setRequestSubrealm(name, parentRealmId, realmClaimType) {
        if (this.options.opType !== 'nft') {
            throw new Error('setRequestSubrealm can only be set for NFT types');
        }
        if (!(0, atomical_format_helpers_1.isAtomicalId)(parentRealmId)) {
            throw new Error('Invalid parent realm atomical id for subrealm');
        }
        if (name.indexOf('.') === -1) {
            throw new Error('Cannot request subrealm for a top level realm');
        }
        const trimmed = name.startsWith('+') ? name.substring(1) : name;
        const splitNames = trimmed.split('.');
        const subrealmFinalPart = splitNames[splitNames.length - 1];
        (0, atomical_format_helpers_1.isValidSubRealmName)(subrealmFinalPart);
        this.requestName = subrealmFinalPart;
        this.requestParentId = parentRealmId;
        this.requestNameType = REQUEST_NAME_TYPE.SUBREALM;
        if (realmClaimType === REALM_CLAIM_TYPE.DIRECT) {
            this.setArgs({
                'claim_type': 'direct'
            });
        }
        else if (realmClaimType === REALM_CLAIM_TYPE.RULE) {
            this.setArgs({
                'claim_type': 'rule'
            });
        }
        else {
            throw new Error('RealmClaimType must be DIRECT or RULE');
        }
    }
    setRequestItem(itemId, parentContainerId) {
        if (this.options.opType !== 'nft') {
            throw new Error('setRequestItem can only be set for NFT types');
        }
        if (!(0, atomical_format_helpers_1.isAtomicalId)(parentContainerId)) {
            throw new Error('Invalid parent container atomical id for item');
        }
        this.requestName = itemId;
        this.requestParentId = parentContainerId;
        this.requestNameType = REQUEST_NAME_TYPE.ITEM;
    }
    setRequestTicker(name) {
        if (this.options.opType !== 'dft' && this.options.opType !== 'ft') {
            throw new Error('setRequestTicker can only be set for dft or ft types');
        }
        const trimmed = name.startsWith('$') ? name.substring(1) : name;
        (0, atomical_format_helpers_1.isValidTickerName)(trimmed);
        this.requestName = trimmed;
        this.requestNameType = REQUEST_NAME_TYPE.TICKER;
        this.requestParentId = null;
    }
    /**
     * For each array element do:
     *
     * - determine if it's a file, or a file with an alias, or a scalar/json object type
     *
     * @param fieldTypeHints The type hint string array
     */
    static getDataObjectFromStringTypeHints(fieldTypeHints) {
        return __awaiter(this, void 0, void 0, function* () {
            return (0, command_helpers_1.prepareFilesDataAsObject)(fieldTypeHints);
        });
    }
    setData(data, log = false) {
        if (!data) {
            return;
        }
        if (typeof data !== 'object') {
            throw new Error('Data must be an object');
        }
        /*if (data['args']) {
            throw new Error(`Data cannot have field named 'args' set manually. Use setArgs method.`);
        }*/
        if (data['meta']) {
            throw new Error(`Data cannot have field named 'meta' set manually. Use options config.`);
        }
        if (data['ctx']) {
            throw new Error(`Data cannot have field named 'ctx' set manually. Use options config.`);
        }
        if (data['init']) {
            throw new Error(`Data cannot have field named 'init' set manually. Use options config.`);
        }
        this.userDefinedData = data;
        if (log) {
            console.log('setData', this.userDefinedData);
        }
    }
    getData() {
        return this.userDefinedData;
    }
    setArgs(args) {
        this.args = args;
    }
    getArgs() {
        return this.args;
    }
    setInit(init) {
        this.init = init;
    }
    getInit() {
        return this.init;
    }
    setMeta(meta) {
        this.meta = meta;
    }
    getMeta() {
        return this.meta;
    }
    setCtx(ctx) {
        this.ctx = ctx;
    }
    getCtx() {
        return this.ctx;
    }
    setContainerMembership(containerName) {
        if (!containerName) {
            throw new Error('Empty container name');
        }
        const trimmedContainerName = containerName.startsWith('#') ? containerName.substring(1) : containerName;
        if (!(0, atomical_format_helpers_1.isValidContainerName)(trimmedContainerName)) {
            return;
        }
        this.containerMembership = trimmedContainerName;
    }
    setBitworkCommit(bitworkString) {
        if (!bitworkString) {
            return;
        }
        this.bitworkInfoCommit = (0, atomical_format_helpers_1.isValidBitworkString)(bitworkString);
    }
    setBitworkReveal(bitworkString) {
        if (!bitworkString) {
            return;
        }
        this.bitworkInfoReveal = (0, atomical_format_helpers_1.isValidBitworkString)(bitworkString);
    }
    /**
     *
     * @param utxoPartial The UTXO to spend in the constructed tx
     * @param wif The signing WIF key for the utxo
     */
    addInputUtxo(utxoPartial, wif) {
        const keypairInput = ECPair.fromWIF(wif);
        const keypairInputInfo = (0, address_keypair_path_1.getKeypairInfo)(keypairInput);
        this.inputUtxos.push({
            utxo: utxoPartial,
            keypairInfo: keypairInputInfo,
        });
    }
    /**
     * Set an input parent for linking with $parent reference of the operation to an input spend
     */
    setInputParent(input) {
        // Validate the parentId is an atomical id in compact form
        if (!(0, atomical_format_helpers_1.isAtomicalId)(input.parentId)) {
            throw new Error('Invalid parent atomical id: ' + input.parentId);
        }
        this.parentInputAtomical = input;
    }
    getInputParent() {
        if (!this.parentInputAtomical) {
            return null;
        }
        return this.parentInputAtomical;
    }
    /**
     * Additional output to add, to be used with addInputUtxo normally
     * @param output Output to add
     */
    addOutput(output) {
        this.additionalOutputs.push(output);
    }
    isEmpty(obj) {
        return Object.keys(obj).length === 0;
    }
    start(fundingWIF) {
        var _a, _b, _c, _d, _e, _f, _g;
        return __awaiter(this, void 0, void 0, function* () {
            const fundingKeypairRaw = ECPair.fromWIF(fundingWIF);
            const fundingKeypair = (0, address_keypair_path_1.getKeypairInfo)(fundingKeypairRaw);
            let performBitworkForRevealTx = !!this.bitworkInfoReveal;
            let performBitworkForCommitTx = !!this.bitworkInfoCommit;
            let scriptP2TR = null;
            let hashLockP2TR = null;
            if (this.options.meta) {
                this.setMeta(yield AtomicalOperationBuilder.getDataObjectFromStringTypeHints(this.options.meta));
            }
            if (this.options.init) {
                this.setInit(yield AtomicalOperationBuilder.getDataObjectFromStringTypeHints(this.options.init));
            }
            if (this.options.ctx) {
                this.setCtx(yield AtomicalOperationBuilder.getDataObjectFromStringTypeHints(this.options.ctx));
            }
            let copiedData = Object.assign({}, this.userDefinedData); //
            if (!this.isEmpty(this.getArgs())) {
                copiedData['args'] = this.getArgs();
            }
            if (!this.isEmpty(this.getCtx())) {
                copiedData['ctx'] = this.getCtx();
            }
            if (!this.isEmpty(this.getMeta())) {
                copiedData['meta'] = this.getMeta();
            }
            if (!this.isEmpty(this.getInit())) {
                copiedData['init'] = this.getInit();
            }
            // If it's a container membership request, add it in
            if (this.containerMembership) {
                copiedData['in'] = `["#${this.containerMembership}"]`;
            }
            switch (this.requestNameType) {
                case REQUEST_NAME_TYPE.TICKER:
                    copiedData['args'] = copiedData['args'] || {};
                    copiedData['args']['request_ticker'] = this.requestName;
                    break;
                case REQUEST_NAME_TYPE.REALM:
                    copiedData['args'] = copiedData['args'] || {};
                    copiedData['args']['request_realm'] = this.requestName;
                    break;
                case REQUEST_NAME_TYPE.SUBREALM:
                    copiedData['args'] = copiedData['args'] || {};
                    copiedData['args']['request_subrealm'] = this.requestName;
                    copiedData['args']['parent_realm'] = this.requestParentId;
                    break;
                case REQUEST_NAME_TYPE.CONTAINER:
                    copiedData['args'] = copiedData['args'] || {};
                    copiedData['args']['request_container'] = this.requestName;
                    break;
                case REQUEST_NAME_TYPE.ITEM:
                    copiedData['args'] = copiedData['args'] || {};
                    copiedData['args']['request_dmitem'] = this.requestName;
                    copiedData['args']['parent_container'] = this.requestParentId;
                    console.log(copiedData);
                    console.log(' this.requestParentId;', this.requestParentId);
                default:
                    break;
            }
            if (performBitworkForCommitTx) {
                copiedData['args'] = copiedData['args'] || {};
                copiedData['args']['bitworkc'] = (_a = this.bitworkInfoCommit) === null || _a === void 0 ? void 0 : _a.hex_bitwork;
            }
            if (performBitworkForRevealTx) {
                copiedData['args'] = copiedData['args'] || {};
                copiedData['args']['bitworkr'] = (_b = this.bitworkInfoReveal) === null || _b === void 0 ? void 0 : _b.hex_bitwork;
            }
            if (this.options.opType === 'dmt') {
                copiedData['args'] = copiedData['args'] || {};
                copiedData['args']['mint_ticker'] = (_c = this.options.dmtOptions) === null || _c === void 0 ? void 0 : _c.ticker;
            }
            let parentAtomicalInfo = this.getInputParent();
            if (parentAtomicalInfo) {
                copiedData['args'] = copiedData['args'] || {};
                copiedData['args']['parents'] = { [parentAtomicalInfo.parentId]: 0 }; // Also supports one parent for now
            }
            let unixtime = Math.floor(Date.now() / 1000);
            let nonce = Math.floor(Math.random() * 10000000);
            let noncesGenerated = 0;
            let atomicalId = null;
            let commitTxid = null;
            let revealTxid = null;
            let commitMinedWithBitwork = false;
            // Placeholder for only estimating tx deposit fee size.
            if (performBitworkForCommitTx) {
                copiedData['args']['nonce'] = 9999999;
                copiedData['args']['time'] = unixtime;
            }
            console.log('copiedData', copiedData);
            const mockAtomPayload = new command_helpers_1.AtomicalsPayload(copiedData);
            if (this.options.verbose) {
                console.log('copiedData', copiedData);
            }
            const payloadSize = mockAtomPayload.cbor().length;
            console.log('Payload CBOR Size (bytes): ', payloadSize);
            if (payloadSize <= 1000) {
                console.log('Payload Encoded: ', copiedData);
            }
            const mockBaseCommitForFeeCalculation = (0, command_helpers_1.prepareCommitRevealConfig)(this.options.opType, fundingKeypair, mockAtomPayload);
            const fees = this.calculateFeesRequiredForAccumulatedCommitAndReveal(mockBaseCommitForFeeCalculation.hashLockP2TR.redeem.output.length);
            ////////////////////////////////////////////////////////////////////////
            // Begin Commit Transaction
            ////////////////////////////////////////////////////////////////////////
            if (performBitworkForCommitTx) {
                const fundingUtxo = yield (0, select_funding_utxo_1.getFundingUtxo)(this.options.electrumApi, fundingKeypair.address, fees.commitAndRevealFeePlusOutputs);
                printBitworkLog(this.bitworkInfoCommit, true);
                this.options.electrumApi.close();
                do {
                    copiedData['args']['nonce'] = nonce;
                    if (noncesGenerated % 5000 == 0) {
                        unixtime = Math.floor(Date.now() / 1000);
                        copiedData['args']['time'] = unixtime;
                        nonce = Math.floor(Math.random() * 10000000);
                    }
                    else {
                        nonce++;
                    }
                    const atomPayload = new command_helpers_1.AtomicalsPayload(copiedData);
                    const updatedBaseCommit = (0, command_helpers_1.prepareCommitRevealConfig)(this.options.opType, fundingKeypair, atomPayload);
                    let psbtStart = new bitcoinjs_lib_1.Psbt({ network: command_helpers_1.NETWORK });
                    psbtStart.setVersion(1);
                    psbtStart.addInput({
                        sequence: this.options.rbf ? command_helpers_1.RBF_INPUT_SEQUENCE : undefined,
                        hash: fundingUtxo.txid,
                        index: fundingUtxo.index,
                        witnessUtxo: { value: fundingUtxo.value, script: Buffer.from(fundingKeypair.output, 'hex') },
                        tapInternalKey: fundingKeypair.childNodeXOnlyPubkey,
                    });
                    psbtStart.addOutput({
                        address: updatedBaseCommit.scriptP2TR.address,
                        value: this.getOutputValueForCommit(fees),
                    });
                    this.addCommitChangeOutputIfRequired(fundingUtxo.value, fees, psbtStart, fundingKeypair.address);
                    psbtStart.signInput(0, fundingKeypair.tweakedChildNode);
                    psbtStart.finalizeAllInputs();
                    let prelimTx = psbtStart.extractTransaction();
                    const checkTxid = prelimTx.getId();
                    logMiningProgressToConsole(performBitworkForCommitTx, this.options.disableMiningChalk, checkTxid, noncesGenerated);
                    // add a `true ||` at the front to test invalid minting
                    // console.log('this.bitworkInfoCommit?.prefix', this.bitworkInfoCommit)
                    if (performBitworkForCommitTx && (0, atomical_format_helpers_1.hasValidBitwork)(checkTxid, (_d = this.bitworkInfoCommit) === null || _d === void 0 ? void 0 : _d.prefix, (_e = this.bitworkInfoCommit) === null || _e === void 0 ? void 0 : _e.ext)) {
                        process.stdout.clearLine(0);
                        process.stdout.cursorTo(0);
                        process.stdout.write(chalk.green(checkTxid, ` nonces: ${noncesGenerated} (${nonce})`));
                        console.log('\nBitwork matches commit txid! ', prelimTx.getId(), `@ time: ${unixtime}`);
                        // We found a solution, therefore broadcast it
                        const interTx = psbtStart.extractTransaction();
                        const rawtx = interTx.toHex();
                        AtomicalOperationBuilder.finalSafetyCheckForExcessiveFee(psbtStart, interTx);
                        if (!(yield this.broadcastWithRetries(rawtx))) {
                            console.log('Error sending', prelimTx.getId(), rawtx);
                            throw new Error('Unable to broadcast commit transaction after attempts: ' + prelimTx.getId());
                        }
                        else {
                            console.log('Success sent tx: ', prelimTx.getId());
                        }
                        commitMinedWithBitwork = true;
                        performBitworkForCommitTx = false;
                    }
                    // In both scenarios we copy over the args
                    if (!performBitworkForCommitTx) {
                        scriptP2TR = updatedBaseCommit.scriptP2TR;
                        hashLockP2TR = updatedBaseCommit.hashLockP2TR;
                    }
                    noncesGenerated++;
                } while (performBitworkForCommitTx);
            }
            else {
                const baseCommit = (0, command_helpers_1.prepareCommitRevealConfig)(this.options.opType, fundingKeypair, new command_helpers_1.AtomicalsPayload(copiedData));
                scriptP2TR = baseCommit.scriptP2TR;
                hashLockP2TR = baseCommit.hashLockP2TR;
            }
            ////////////////////////////////////////////////////////////////////////
            // Begin Reveal Transaction
            ////////////////////////////////////////////////////////////////////////
            // The scriptP2TR and hashLockP2TR will contain the utxo needed for the commit and now can be revealed
            const utxoOfCommitAddress = yield (0, select_funding_utxo_1.getFundingUtxo)(this.options.electrumApi, scriptP2TR.address, this.getOutputValueForCommit(fees), commitMinedWithBitwork, 5);
            commitTxid = utxoOfCommitAddress.txid;
            atomicalId = commitTxid + 'i0'; // Atomicals are always minted at the 0'th output
            const tapLeafScript = {
                leafVersion: hashLockP2TR.redeem.redeemVersion,
                script: hashLockP2TR.redeem.output,
                controlBlock: hashLockP2TR.witness[hashLockP2TR.witness.length - 1]
            };
            if (performBitworkForRevealTx) {
                printBitworkLog(this.bitworkInfoReveal);
            }
            noncesGenerated = 0;
            do {
                let totalInputsforReveal = 0; // We calculate the total inputs for the reveal to determine to make change output or not
                let totalOutputsForReveal = 0; // Calculate total outputs for the reveal and compare to totalInputsforReveal and reveal fee
                let nonce = Math.floor(Math.random() * 100000000);
                let unixTime = Math.floor(Date.now() / 1000);
                let psbt = new bitcoinjs_lib_1.Psbt({ network: command_helpers_1.NETWORK });
                psbt.setVersion(1);
                psbt.addInput({
                    sequence: this.options.rbf ? command_helpers_1.RBF_INPUT_SEQUENCE : undefined,
                    hash: utxoOfCommitAddress.txid,
                    index: utxoOfCommitAddress.vout,
                    witnessUtxo: { value: utxoOfCommitAddress.value, script: hashLockP2TR.output },
                    tapLeafScript: [
                        tapLeafScript
                    ]
                });
                totalInputsforReveal += utxoOfCommitAddress.value;
                // Add any additional inputs that were assigned
                for (const additionalInput of this.inputUtxos) {
                    psbt.addInput({
                        sequence: this.options.rbf ? command_helpers_1.RBF_INPUT_SEQUENCE : undefined,
                        hash: additionalInput.utxo.hash,
                        index: additionalInput.utxo.index,
                        witnessUtxo: additionalInput.utxo.witnessUtxo,
                        tapInternalKey: additionalInput.keypairInfo.childNodeXOnlyPubkey
                    });
                    totalInputsforReveal += additionalInput.utxo.witnessUtxo.value;
                }
                // Note, we do not assign any outputs by default.
                // The caller must decide how many outputs to assign always
                // The reason is the caller knows the context to create them in
                // Add any additional outputs that were assigned
                for (const additionalOutput of this.additionalOutputs) {
                    psbt.addOutput({
                        address: additionalOutput.address,
                        value: additionalOutput.value,
                    });
                    totalOutputsForReveal += additionalOutput.value;
                }
                if (parentAtomicalInfo) {
                    psbt.addInput({
                        sequence: this.options.rbf ? command_helpers_1.RBF_INPUT_SEQUENCE : undefined,
                        hash: parentAtomicalInfo.parentUtxoPartial.hash,
                        index: parentAtomicalInfo.parentUtxoPartial.index,
                        witnessUtxo: parentAtomicalInfo.parentUtxoPartial.witnessUtxo,
                        tapInternalKey: parentAtomicalInfo.parentKeyInfo.childNodeXOnlyPubkey
                    });
                    totalInputsforReveal += parentAtomicalInfo.parentUtxoPartial.witnessUtxo.value;
                    psbt.addOutput({
                        address: parentAtomicalInfo.parentKeyInfo.address,
                        value: parentAtomicalInfo.parentUtxoPartial.witnessUtxo.value,
                    });
                    totalOutputsForReveal += parentAtomicalInfo.parentUtxoPartial.witnessUtxo.value;
                }
                if (noncesGenerated % 10000 == 0) {
                    unixTime = Math.floor(Date.now() / 1000);
                }
                const data = Buffer.from(unixTime + ':' + nonce, 'utf8');
                const embed = bitcoin.payments.embed({ data: [data] });
                if (performBitworkForRevealTx) {
                    psbt.addOutput({
                        script: embed.output,
                        value: 0,
                    });
                }
                this.addRevealOutputIfChangeRequired(totalInputsforReveal, totalOutputsForReveal, fees.revealFeeOnly, fundingKeypair.address);
                psbt.signInput(0, fundingKeypair.childNode);
                // Sign all the additional inputs, if there were any
                let signInputIndex = 1;
                for (const additionalInput of this.inputUtxos) {
                    psbt.signInput(signInputIndex, additionalInput.keypairInfo.tweakedChildNode);
                    signInputIndex++;
                }
                if (parentAtomicalInfo) {
                    console.log('parentAtomicalInfo', parentAtomicalInfo);
                    psbt.signInput(signInputIndex, parentAtomicalInfo.parentKeyInfo.tweakedChildNode);
                }
                // We have to construct our witness script in a custom finalizer
                const customFinalizer = (_inputIndex, input) => {
                    const scriptSolution = [
                        input.tapScriptSig[0].signature,
                    ];
                    const witness = scriptSolution
                        .concat(tapLeafScript.script)
                        .concat(tapLeafScript.controlBlock);
                    return {
                        finalScriptWitness: (0, witness_stack_to_script_witness_1.witnessStackToScriptWitness)(witness)
                    };
                };
                psbt.finalizeInput(0, customFinalizer);
                // Finalize all the additional inputs, if there were any
                let finalizeInputIndex = 1;
                for (; finalizeInputIndex <= this.inputUtxos.length; finalizeInputIndex++) {
                    psbt.finalizeInput(finalizeInputIndex);
                }
                if (parentAtomicalInfo) {
                    psbt.finalizeInput(finalizeInputIndex);
                }
                const revealTx = psbt.extractTransaction();
                const checkTxid = revealTx.getId();
                logMiningProgressToConsole(performBitworkForRevealTx, this.options.disableMiningChalk, checkTxid, noncesGenerated);
                let shouldBroadcast = !performBitworkForRevealTx;
                if (performBitworkForRevealTx && (0, atomical_format_helpers_1.hasValidBitwork)(checkTxid, (_f = this.bitworkInfoReveal) === null || _f === void 0 ? void 0 : _f.prefix, (_g = this.bitworkInfoReveal) === null || _g === void 0 ? void 0 : _g.ext)) {
                    process.stdout.clearLine(0);
                    process.stdout.cursorTo(0);
                    process.stdout.write(chalk.green(checkTxid, ' nonces: ' + noncesGenerated));
                    console.log('\nBitwork matches reveal txid! ', revealTx.getId(), '@ time: ' + Math.floor(Date.now() / 1000));
                    shouldBroadcast = true;
                }
                // Broadcast either because there was no bitwork requested, and we are done. OR...
                // broadcast because we found the bitwork and it is ready to be broadcasted
                if (shouldBroadcast) {
                    AtomicalOperationBuilder.finalSafetyCheckForExcessiveFee(psbt, revealTx);
                    console.log('\nBroadcasting tx...', revealTx.getId());
                    const interTx = psbt.extractTransaction();
                    const rawtx = interTx.toHex();
                    if (!(yield this.broadcastWithRetries(rawtx))) {
                        console.log('Error sending', revealTx.getId(), rawtx);
                        throw new Error('Unable to broadcast reveal transaction after attempts');
                    }
                    else {
                        console.log('Success sent tx: ', revealTx.getId());
                    }
                    revealTxid = interTx.getId();
                    performBitworkForRevealTx = false; // Done
                }
                nonce++;
                noncesGenerated++;
            } while (performBitworkForRevealTx);
            const ret = {
                success: true,
                data: {
                    commitTxid,
                    revealTxid,
                }
            };
            if (this.options.opType === 'nft' || this.options.opType === 'ft' || this.options.opType === 'dft') {
                ret['data']['atomicalId'] = atomicalId;
            }
            if (this.options.opType === 'dat') {
                ret['data']['dataId'] = revealTxid + 'i0';
                ret['data']['urn'] = 'atom:btc:dat:' + revealTxid + 'i0';
            }
            return ret;
        });
    }
    broadcastWithRetries(rawtx) {
        return __awaiter(this, void 0, void 0, function* () {
            let attempts = 0;
            let result = null;
            do {
                try {
                    console.log('rawtx', rawtx);
                    result = yield this.options.electrumApi.broadcast(rawtx);
                    if (result) {
                        break;
                    }
                }
                catch (err) {
                    console.log('Network error broadcasting (Trying again soon...)', err);
                    yield this.options.electrumApi.resetConnection();
                    // Put in a sleep to help the connection reset more gracefully in case there is some delay
                    console.log(`Will retry to broadcast transaction again in ${SEND_RETRY_SLEEP_SECONDS} seconds...`);
                    yield (0, utils_1.sleeper)(SEND_RETRY_SLEEP_SECONDS);
                }
                attempts++;
            } while (attempts < SEND_RETRY_ATTEMPTS);
            return result;
        });
    }
    static translateFromBase32ToHex(bitwork) {
        return bitwork;
    }
    totalOutputSum() {
        let sum = 0;
        for (const additionalOutput of this.additionalOutputs) {
            sum += additionalOutput.value;
        }
        return sum;
    }
    getTotalAdditionalInputValues() {
        let sum = 0;
        for (const utxo of this.inputUtxos) {
            sum += utxo.utxo.witnessUtxo.value;
        }
        return sum;
    }
    getTotalAdditionalOutputValues() {
        let sum = 0;
        for (const output of this.additionalOutputs) {
            sum += output.value;
        }
        return sum;
    }
    calculateAmountRequiredForReveal(hashLockP2TROutputLen = 0) {
        // <Previous txid> <Output index> <Length of scriptSig> <Sequence number>
        // 32 + 4 + 1 + 4 = 41
        // <Witness stack item length> <Signature> ... <Control block>
        // (1 + 65 + 34) / 4 = 25
        // Total: 41 + 25 = 66
        const REVEAL_INPUT_BYTES_BASE = 66;
        let hashLockCompactSizeBytes = 9;
        if (hashLockP2TROutputLen <= 252) {
            hashLockCompactSizeBytes = 1;
        }
        else if (hashLockP2TROutputLen <= 0xffff) {
            hashLockCompactSizeBytes = 3;
        }
        else if (hashLockP2TROutputLen <= 0xffffffff) {
            hashLockCompactSizeBytes = 5;
        }
        return Math.ceil(this.options.satsbyte *
            (BASE_BYTES +
                // Reveal input
                REVEAL_INPUT_BYTES_BASE +
                ((hashLockCompactSizeBytes + hashLockP2TROutputLen) / 4) +
                // Additional inputs
                this.inputUtxos.length * INPUT_BYTES_BASE +
                // Outputs
                this.additionalOutputs.length * OUTPUT_BYTES_BASE));
    }
    calculateFeesRequiredForCommit() {
        return Math.ceil(this.options.satsbyte *
            (BASE_BYTES +
                (1 * INPUT_BYTES_BASE) +
                (1 * OUTPUT_BYTES_BASE)));
    }
    getOutputValueForCommit(fees) {
        // Note that `Additional inputs` refers to the additional inputs in a reveal tx.
        return fees.revealFeePlusOutputs - this.getTotalAdditionalInputValues();
    }
    getAdditionalFundingRequiredForReveal() {
        return 0;
    }
    /**
     * Get the commit and reveal fee. The commit fee assumes it is chained together
     * @returns
     */
    calculateFeesRequiredForAccumulatedCommitAndReveal(hashLockP2TROutputLen = 0) {
        const revealFee = this.calculateAmountRequiredForReveal(hashLockP2TROutputLen);
        const commitFee = this.calculateFeesRequiredForCommit();
        const commitAndRevealFee = commitFee + revealFee;
        const commitAndRevealFeePlusOutputs = commitFee + revealFee + this.totalOutputSum();
        const revealFeePlusOutputs = revealFee + this.totalOutputSum();
        const ret = {
            commitAndRevealFee,
            commitAndRevealFeePlusOutputs,
            revealFeePlusOutputs,
            commitFeeOnly: commitFee,
            revealFeeOnly: revealFee
        };
        return ret;
    }
    /**
     * Adds an extra output at the end if it was detected there would be excess satoshis for the reveal transaction
     * @param fee Fee calculations
     * @returns
     */
    addRevealOutputIfChangeRequired(totalInputsValue, totalOutputsValue, revealFee, address) {
        const currentSatoshisFeePlanned = totalInputsValue - totalOutputsValue;
        // It will be invalid, but at least we know we don't need to add change
        if (currentSatoshisFeePlanned <= 0) {
            return;
        }
        // In order to keep the fee-rate unchanged, we should add extra fee for the new added change output.
        const excessSatoshisFound = currentSatoshisFeePlanned - revealFee - this.options.satsbyte * OUTPUT_BYTES_BASE;
        // There were no excess satoshis, therefore no change is due
        if (excessSatoshisFound <= 0) {
            return;
        }
        // There were some excess satoshis, but let's verify that it meets the dust threshold to make change
        if (excessSatoshisFound >= DUST_AMOUNT) {
            this.addOutput({
                address: address,
                value: excessSatoshisFound
            });
        }
    }
    /**
    * Adds an extra output at the end if it was detected there would be excess satoshis for the reveal transaction
    * @param fee Fee calculations
    * @returns
    */
    addCommitChangeOutputIfRequired(extraInputValue, fee, pbst, address) {
        const totalInputsValue = extraInputValue;
        const totalOutputsValue = this.getOutputValueForCommit(fee);
        const calculatedFee = totalInputsValue - totalOutputsValue;
        // It will be invalid, but at least we know we don't need to add change
        if (calculatedFee <= 0) {
            return;
        }
        // In order to keep the fee-rate unchanged, we should add extra fee for the new added change output.
        const expectedFee = fee.commitFeeOnly + this.options.satsbyte * OUTPUT_BYTES_BASE;
        // console.log('expectedFee', expectedFee);
        const differenceBetweenCalculatedAndExpected = calculatedFee - expectedFee;
        if (differenceBetweenCalculatedAndExpected <= 0) {
            return;
        }
        // There were some excess satoshis, but let's verify that it meets the dust threshold to make change
        if (differenceBetweenCalculatedAndExpected >= DUST_AMOUNT) {
            pbst.addOutput({
                address: address,
                value: differenceBetweenCalculatedAndExpected
            });
        }
    }
    /**
     * a final safety check to ensure we don't accidentally broadcast a tx with too high of a fe
     * @param psbt Partially signed bitcoin tx coresponding to the tx to calculate the total inputs values provided
     * @param tx The tx to broadcast, uses the outputs to calculate total outputs
     */
    static finalSafetyCheckForExcessiveFee(psbt, tx) {
        let sumInputs = 0;
        psbt.data.inputs.map((inp) => {
            sumInputs += inp.witnessUtxo.value;
        });
        let sumOutputs = 0;
        tx.outs.map((out) => {
            sumOutputs += out.value;
        });
        if (sumInputs - sumOutputs > EXCESSIVE_FEE_LIMIT) {
            throw new Error(`Excessive fee detected. Hardcoded to ${EXCESSIVE_FEE_LIMIT} satoshis. Aborting due to protect funds. Contact developer`);
        }
    }
    /**
     * Helper function to resolve a parent atomical id and the wallet record into a format that's easily processable by setInputParent
     * @param electrumxApi
     * @param parentId
     * @param parentOwner
     */
    static resolveInputParent(electrumxApi, parentId, parentOwner) {
        return __awaiter(this, void 0, void 0, function* () {
            const { atomicalInfo, locationInfo, inputUtxoPartial } = yield (0, command_helpers_1.getAndCheckAtomicalInfo)(electrumxApi, parentId, parentOwner.address);
            const parentKeypairInput = ECPair.fromWIF(parentOwner.WIF);
            const parentKeypairInputInfo = (0, address_keypair_path_1.getKeypairInfo)(parentKeypairInput);
            const inp = {
                parentId,
                parentUtxoPartial: inputUtxoPartial,
                parentKeyInfo: parentKeypairInputInfo
            };
            return inp;
        });
    }
}
exports.AtomicalOperationBuilder = AtomicalOperationBuilder;
