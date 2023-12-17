"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateSubrealmRulesObject = exports.decorateAtomical = exports.decorateAtomicals = exports.expandMintBlockInfo = exports.expandLocationInfo = exports.expandDataDecoded = exports.hexifyObjectWithUtf8 = exports.isValidTickerName = exports.isValidSubRealmName = exports.isValidRealmName = exports.isValidContainerName = exports.isValidDmitemName = exports.isValidNameBase = exports.isValidBitworkString = exports.isValidBitworkConst = exports.isValidBitworkMinimum = exports.checkBaseRequestOptions = exports.hasValidBitwork = exports.hasAtomicalType = exports.isValidBitworkHex = exports.isBitworkHexPrefix = exports.isBitworkRefBase32Prefix = exports.decodePayloadCBOR = exports.buildAtomicalsFileMapFromRawTx = exports.extractFileFromInputWitness = exports.parseAtomicalsDataDefinitionOperation = exports.compactIdToOutpointBytesAndHex = exports.compactIdToOutpoint = exports.outpointToCompactId = exports.getIndexFromAtomicalId = exports.getTxIdFromAtomicalId = exports.isAtomicalId = exports.getAtomicalIdentifierType = exports.encodeIds = exports.encodeHashToBuffer = exports.encodeAtomicalIdToBuffer = exports.encodeAtomicalIdToBinaryElementHex = exports.isObject = exports.AtomicalIdentifierType = void 0;
const ecc = require("tiny-secp256k1");
const bitcoinjs_lib_1 = require("bitcoinjs-lib");
const __1 = require("..");
const dotenv = require("dotenv");
dotenv.config();
(0, bitcoinjs_lib_1.initEccLib)(ecc);
const cbor = require("borc");
const address_helpers_1 = require("./address-helpers");
const protocol_tags_1 = require("../types/protocol-tags");
const api_interface_1 = require("../interfaces/api.interface");
const CrockfordBase32 = require("crockford-base32");
const mintnft = 'nft';
const mintft = 'ft';
const mintdft = 'dft';
const update = 'mod';
const event = 'evt';
const storedat = 'dat';
var AtomicalIdentifierType;
(function (AtomicalIdentifierType) {
    AtomicalIdentifierType["ATOMICAL_ID"] = "ATOMICAL_ID";
    AtomicalIdentifierType["ATOMICAL_NUMBER"] = "ATOMICAL_NUMBER";
    AtomicalIdentifierType["REALM_NAME"] = "REALM_NAME";
    AtomicalIdentifierType["CONTAINER_NAME"] = "CONTAINER_NAME";
    AtomicalIdentifierType["TICKER_NAME"] = "TICKER_NAME";
})(AtomicalIdentifierType = exports.AtomicalIdentifierType || (exports.AtomicalIdentifierType = {}));
const isObject = (p) => {
    if (typeof p === 'object' &&
        !Array.isArray(p) &&
        p !== null) {
        return true;
    }
    return false;
};
exports.isObject = isObject;
const encodeAtomicalIdToBinaryElementHex = (v) => {
    if (!isAtomicalId(v)) {
        throw new Error('Not atomical Id ' + v);
    }
    const result = compactIdToOutpointBytesAndHex(v);
    return {
        "$b": result.hex
    };
};
exports.encodeAtomicalIdToBinaryElementHex = encodeAtomicalIdToBinaryElementHex;
const encodeAtomicalIdToBuffer = (v) => {
    if (!isAtomicalId(v)) {
        throw new Error('Not atomical Id ' + v);
    }
    const result = compactIdToOutpointBytesAndHex(v);
    return result.buf;
};
exports.encodeAtomicalIdToBuffer = encodeAtomicalIdToBuffer;
const encodeHashToBuffer = (v) => {
    if (!v || v.length !== 64) {
        throw new Error('Not valid sha256 hash ' + v);
    }
    return Buffer.from(v, 'hex');
};
exports.encodeHashToBuffer = encodeHashToBuffer;
const encodeIds = (jsonObject, updatedObject, atomicalIdEncodingFunc, otherEncodingFunc, autoEncodePattern) => {
    if (!(0, exports.isObject)(jsonObject)) {
        return;
    }
    for (const prop in jsonObject) {
        if (!jsonObject.hasOwnProperty(prop)) {
            continue;
        }
        if (prop === 'id' && isAtomicalId(jsonObject['id'])) {
            updatedObject[prop] = atomicalIdEncodingFunc(jsonObject['id']);
        }
        else if (autoEncodePattern && prop.endsWith(autoEncodePattern)) {
            updatedObject[prop] = otherEncodingFunc(jsonObject[prop]);
        }
        else {
            updatedObject[prop] = jsonObject[prop];
            (0, exports.encodeIds)(jsonObject[prop], updatedObject[prop], atomicalIdEncodingFunc, otherEncodingFunc, autoEncodePattern);
        }
    }
    return updatedObject;
};
exports.encodeIds = encodeIds;
/** Checks whether a string is an atomicalId, realm/subrealm name, container or ticker */
const getAtomicalIdentifierType = (providedIdentifier) => {
    if (isAtomicalId(providedIdentifier)) {
        return {
            type: AtomicalIdentifierType.ATOMICAL_ID,
            providedIdentifier
        };
    }
    if (providedIdentifier === null) {
        throw new Error('atomicalId, number or name of some kind must be provided such as +name, $ticker, or #container');
    }
    if (parseInt(providedIdentifier, 10) == providedIdentifier) {
        return {
            type: AtomicalIdentifierType.ATOMICAL_NUMBER,
            providedIdentifier
        };
    }
    // If it's a realm/subrealm
    if (providedIdentifier.startsWith('+')) {
        return {
            type: AtomicalIdentifierType.REALM_NAME,
            providedIdentifier: providedIdentifier,
            realmName: providedIdentifier.substring(1),
        };
    }
    else if (providedIdentifier.indexOf('.') !== -1) {
        // If there is at least one dot . then assume it's a subrealm type
        return {
            type: AtomicalIdentifierType.REALM_NAME,
            providedIdentifier: providedIdentifier,
            realmName: providedIdentifier,
        };
    }
    else if (providedIdentifier.startsWith('#')) {
        return {
            type: AtomicalIdentifierType.CONTAINER_NAME,
            providedIdentifier: providedIdentifier,
            containerName: providedIdentifier.substring(1),
        };
    }
    else if (providedIdentifier.startsWith('$')) {
        return {
            type: AtomicalIdentifierType.TICKER_NAME,
            providedIdentifier: providedIdentifier,
            tickerName: providedIdentifier.substring(1),
        };
    }
    else {
        // Since there is a bug on the command line accepting the dollar sign $, we just assume it's a ticker if it's a raw string
        // The way to get the command line to accept the dollar sign is put the argument in single quotes like: yarn cli get '$ticker'
        return {
            type: AtomicalIdentifierType.TICKER_NAME,
            providedIdentifier: providedIdentifier,
            tickerName: providedIdentifier
        };
    }
};
exports.getAtomicalIdentifierType = getAtomicalIdentifierType;
function isAtomicalId(atomicalId) {
    if (!atomicalId || !atomicalId.length || atomicalId.indexOf('i') !== 64) {
        return false;
    }
    try {
        const splitParts = atomicalId.split('i');
        const txid = splitParts[0];
        const index = parseInt(splitParts[1], 10);
        return {
            txid,
            index,
            atomicalId
        };
    }
    catch (err) {
    }
    return null;
}
exports.isAtomicalId = isAtomicalId;
function getTxIdFromAtomicalId(atomicalId) {
    if (atomicalId.length === 64) {
        return atomicalId;
    }
    if (atomicalId.indexOf('i') !== 64) {
        throw "Invalid atomicalId";
    }
    return atomicalId.substring(0, 64);
}
exports.getTxIdFromAtomicalId = getTxIdFromAtomicalId;
function getIndexFromAtomicalId(atomicalId) {
    if (atomicalId.indexOf('i') !== 64) {
        throw "Invalid atomicalId";
    }
    return parseInt(atomicalId.split('i')[1], 10);
}
exports.getIndexFromAtomicalId = getIndexFromAtomicalId;
function outpointToCompactId(outpointHex) {
    if (outpointHex.length !== 72) {
        throw new Error('Invalid outpoint hex');
    }
    const txidPart = outpointHex.substring(0, 64);
    const numPart = outpointHex.substring(64);
    const txid = Buffer.from(txidPart, 'hex').reverse().toString('hex');
    let indexNum = Buffer.from(numPart, 'hex').readUint32LE();
    let compactId = txid + 'i' + indexNum;
    return compactId;
}
exports.outpointToCompactId = outpointToCompactId;
/** Convert a location_id or atomical_id to the outpoint (36 bytes hex string) */
function compactIdToOutpoint(locationId) {
    let txid = getTxIdFromAtomicalId(locationId);
    txid = Buffer.from(txid, 'hex').reverse();
    const index = getIndexFromAtomicalId(locationId);
    let numberValue = Buffer.allocUnsafe(4);
    numberValue.writeUint32LE(index);
    return txid.toString('hex') + numberValue.toString('hex');
}
exports.compactIdToOutpoint = compactIdToOutpoint;
function compactIdToOutpointBytesAndHex(locationId) {
    let txid = getTxIdFromAtomicalId(locationId);
    txid = Buffer.from(txid, 'hex').reverse();
    const index = getIndexFromAtomicalId(locationId);
    let numberValue = Buffer.allocUnsafe(4);
    numberValue.writeUint32LE(index);
    return {
        buf: Buffer.concat([txid, numberValue]),
        hex: txid.toString('hex') + numberValue.toString('hex'),
    };
}
exports.compactIdToOutpointBytesAndHex = compactIdToOutpointBytesAndHex;
function parseAtomicalsDataDefinitionOperation(opType, script, n, hexify = false, addUtf8 = false) {
    let rawdata = Buffer.allocUnsafe(0);
    try {
        while (n < script.length) {
            const op = script[n];
            n += 1;
            // define the next instruction type
            if (op == __1.bitcoin.opcodes.OP_ENDIF) {
                break;
            }
            else if (Buffer.isBuffer(op)) {
                rawdata = Buffer.concat([rawdata, op]);
            }
        }
    }
    catch (err) {
        throw 'parse_atomicals_mint_operation script error';
    }
    console.log('decoded', rawdata);
    let decoded = {};
    try {
        decoded = decodePayloadCBOR(rawdata, hexify, addUtf8);
    }
    catch (error) {
        console.log('Error for atomical CBOR parsing ', error);
        throw error;
    }
    if (hexify) {
        rawdata = rawdata.toString('hex');
    }
    return {
        opType,
        rawdata,
        decoded
    };
}
exports.parseAtomicalsDataDefinitionOperation = parseAtomicalsDataDefinitionOperation;
function extractFileFromInputWitness(inputWitness, hexify = false, addUtf8 = false, markerSentinel = protocol_tags_1.ATOMICALS_PROTOCOL_ENVELOPE_ID) {
    for (const item of inputWitness) {
        const witnessScript = bitcoinjs_lib_1.script.decompile(item);
        if (!witnessScript) {
            continue; // not valid script
        }
        for (let i = 0; i < witnessScript.length; i++) {
            if (witnessScript[i] === __1.bitcoin.opcodes.OP_IF) {
                do {
                    if (Buffer.isBuffer(witnessScript[i]) && witnessScript[i].toString('utf8') === markerSentinel) {
                        for (; i < witnessScript.length; i++) {
                            if (Buffer.isBuffer(witnessScript[i])) {
                                const opType = witnessScript[i].toString('utf8');
                                if (Buffer.isBuffer(witnessScript[i]) && (opType === mintnft || opType === update || opType === mintft || opType === mintdft || opType === event || opType == storedat)) {
                                    return parseAtomicalsDataDefinitionOperation(opType, witnessScript, i + 1, hexify, addUtf8);
                                }
                            }
                        }
                    }
                    i++;
                    if (i >= witnessScript.length) {
                        break;
                    }
                } while (witnessScript[i] !== __1.bitcoin.opcodes.OP_ENDIF);
            }
        }
    }
    return {};
}
exports.extractFileFromInputWitness = extractFileFromInputWitness;
function buildAtomicalsFileMapFromRawTx(rawtx, hexify = false, addUtf8 = false, markerSentinel = protocol_tags_1.ATOMICALS_PROTOCOL_ENVELOPE_ID) {
    const tx = bitcoinjs_lib_1.Transaction.fromHex(rawtx);
    const filemap = {};
    let i = 0;
    for (const input of tx.ins) {
        if (input.witness) {
            const fileInWitness = extractFileFromInputWitness(input.witness, hexify, addUtf8, markerSentinel);
            if (fileInWitness) {
                filemap[i] = fileInWitness;
            }
        }
        i++;
    }
    return filemap;
}
exports.buildAtomicalsFileMapFromRawTx = buildAtomicalsFileMapFromRawTx;
function decodePayloadCBOR(payload, hexify = true, addUtf8 = false) {
    if (hexify) {
        return hexifyObjectWithUtf8(cbor.decode(payload), addUtf8);
    }
    else {
        return cbor.decode(payload);
    }
}
exports.decodePayloadCBOR = decodePayloadCBOR;
const errMessage = 'Invalid --bitwork value. Must be hex with a single optional . dot separated with a number of 1 to 15 with no more than 10 hex characters. Example: 0123 or 3456.12';
const isBitworkRefBase32Prefix = (bitwork) => {
    if (/^[abcdefghjkmnpqrstvwxyz0-9]{1,10}$/.test(bitwork)) {
        const enc = CrockfordBase32.CrockfordBase32.decode(bitwork);
        return enc.toString('hex').toLowerCase();
    }
    return null;
};
exports.isBitworkRefBase32Prefix = isBitworkRefBase32Prefix;
const isBitworkHexPrefix = (bitwork) => {
    if (/^[a-f0-9]{1,10}$/.test(bitwork)) {
        return true;
    }
    return false;
};
exports.isBitworkHexPrefix = isBitworkHexPrefix;
const isValidBitworkHex = (bitwork) => {
    if (!/^[a-f0-9]{1,10}$/.test(bitwork)) {
        throw new Error(errMessage);
    }
};
exports.isValidBitworkHex = isValidBitworkHex;
const hasAtomicalType = (type, atomicals) => {
    for (const item of atomicals) {
        if (item.type === type) {
            return true;
        }
    }
    return false;
};
exports.hasAtomicalType = hasAtomicalType;
const hasValidBitwork = (txid, bitwork, bitworkx) => {
    if (txid.startsWith(bitwork)) {
        if (!bitworkx) {
            return true;
        }
        else {
            const next_char = txid[bitwork.length];
            const char_map = {
                '0': 0,
                '1': 1,
                '2': 2,
                '3': 3,
                '4': 4,
                '5': 5,
                '6': 6,
                '7': 7,
                '8': 8,
                '9': 9,
                'a': 10,
                'b': 11,
                'c': 12,
                'd': 13,
                'e': 14,
                'f': 15
            };
            const get_numeric_value = char_map[next_char];
            if (get_numeric_value >= bitworkx) {
                return true;
            }
        }
    }
    return false;
};
exports.hasValidBitwork = hasValidBitwork;
const checkBaseRequestOptions = (options) => {
    if (!options) {
        options = api_interface_1.BASE_REQUEST_OPTS_DEFAULTS;
    }
    else if (!options.satsbyte) {
        options.satsbyte = 10;
    }
    if (!options.satsoutput) {
        options.satsoutput = 546;
    }
    if (typeof options.satsbyte !== 'number') {
        options.satsbyte = parseInt(options.satsbyte, 10);
    }
    if (typeof options.satsoutput !== 'number') {
        options.satsoutput = parseInt(options.satsoutput, 10);
    }
    return options;
};
exports.checkBaseRequestOptions = checkBaseRequestOptions;
const isValidBitworkMinimum = (bitworkc) => {
    if (!bitworkc) {
        throw new Error('Require at least 4 hex digits or 3 ascii digits for any bitwork.');
    }
    const bitworkInfoCommit = (0, exports.isValidBitworkString)(bitworkc);
    if ((bitworkInfoCommit === null || bitworkInfoCommit === void 0 ? void 0 : bitworkInfoCommit.prefix) && (bitworkInfoCommit === null || bitworkInfoCommit === void 0 ? void 0 : bitworkInfoCommit.prefix.length) < 4) {
        console.log('bitworkInfoCommit', bitworkInfoCommit);
        throw new Error('Require at least --bitworkc with 4 hex digits or 3 ascii digits.');
    }
};
exports.isValidBitworkMinimum = isValidBitworkMinimum;
const isValidBitworkConst = (bitwork_val) => {
    return bitwork_val === 'any';
};
exports.isValidBitworkConst = isValidBitworkConst;
const isValidBitworkString = (fullstring, safety = true) => {
    if (!fullstring) {
        throw new Error(errMessage);
    }
    if (fullstring && fullstring.indexOf('.') === -1) {
        if ((0, exports.isBitworkHexPrefix)(fullstring)) {
            return {
                input_bitwork: fullstring,
                hex_bitwork: fullstring,
                prefix: fullstring,
                ext: undefined
            };
        }
        else if ((0, exports.isBitworkRefBase32Prefix)(fullstring)) {
            const hex_encoded = (0, exports.isBitworkRefBase32Prefix)(fullstring);
            if (!hex_encoded) {
                throw new Error('invalid base32 encoding: ' + fullstring);
            }
            return {
                input_bitwork: fullstring,
                hex_bitwork: hex_encoded,
                prefix: hex_encoded,
                ext: undefined
            };
        }
        else {
            throw new Error('Invalid bitwork string: ' + fullstring);
        }
    }
    const splitted = fullstring.split('.');
    if (splitted.length !== 2) {
        throw new Error(errMessage);
    }
    let hex_prefix = null;
    if ((0, exports.isBitworkHexPrefix)(splitted[0])) {
        hex_prefix = splitted[0];
    }
    else if ((0, exports.isBitworkRefBase32Prefix)(splitted[0])) {
        hex_prefix = (0, exports.isBitworkRefBase32Prefix)(splitted[0]);
        if (!hex_prefix) {
            throw new Error('invalid base32 encoding: ' + splitted[0]);
        }
    }
    else {
        throw new Error('Invalid bitwork string: ' + fullstring);
    }
    const parsedNum = parseInt(splitted[1], 10);
    if (isNaN(parsedNum)) {
        throw new Error(errMessage);
    }
    if (parsedNum <= 0 || parsedNum > 15) {
        throw new Error(errMessage);
    }
    if (safety) {
        if (splitted[0].length >= 10) {
            throw new Error('Safety check triggered: Prefix length is >= 8. Override with safety=false');
        }
    }
    let hex_bitwork = '';
    if (parsedNum) {
        hex_bitwork = `${hex_prefix}.${parsedNum}`;
    }
    return {
        input_bitwork: fullstring,
        hex_bitwork: hex_bitwork,
        prefix: hex_prefix,
        ext: parsedNum,
    };
};
exports.isValidBitworkString = isValidBitworkString;
const isValidNameBase = (name, isTLR = false) => {
    if (!name) {
        throw new Error('Null name');
    }
    if (name.length > 64 || name.length === 0) {
        throw new Error('Name cannot be longer than 64 characters and must be at least 1 character');
    }
    if (name[0] === '-') {
        throw new Error('Name cannot begin with a hyphen');
    }
    if (name[name.length - 1] === '-') {
        throw new Error('Name cannot end with a hyphen');
    }
    if (isTLR) {
        if (name[0] >= '0' && name[0] <= '9') {
            throw new Error('Top level realm name cannot start with a number');
        }
    }
    return true;
};
exports.isValidNameBase = isValidNameBase;
const isValidDmitemName = (name) => {
    (0, exports.isValidNameBase)(name);
    if (!/^[a-z0-9][a-z0-9\-]{0,63}$/.test(name)) {
        throw new Error('Invalid dmitem name: ' + name);
    }
    return true;
};
exports.isValidDmitemName = isValidDmitemName;
const isValidContainerName = (name) => {
    (0, exports.isValidNameBase)(name);
    if (!/^[a-z0-9][a-z0-9\-]{0,63}$/.test(name)) {
        throw new Error('Invalid container name');
    }
    return true;
};
exports.isValidContainerName = isValidContainerName;
const isValidRealmName = (name) => {
    const isTLR = true;
    (0, exports.isValidNameBase)(name, isTLR);
    if (!/^[a-z][a-z0-9\-]{0,63}$/.test(name)) {
        throw new Error('Invalid realm name');
    }
    return true;
};
exports.isValidRealmName = isValidRealmName;
const isValidSubRealmName = (name) => {
    (0, exports.isValidNameBase)(name);
    if (!/^[a-z0-9][a-z0-9\-]{0,63}$/.test(name)) {
        throw new Error('Invalid subrealm name');
    }
    return true;
};
exports.isValidSubRealmName = isValidSubRealmName;
const isValidTickerName = (name) => {
    (0, exports.isValidNameBase)(name);
    if (!/^[a-z0-9]{1,21}$/.test(name)) {
        throw new Error('Invalid ticker name');
    }
    return true;
};
exports.isValidTickerName = isValidTickerName;
function hexifyObjectWithUtf8(obj, utf8 = true) {
    function isBuffer(obj) {
        return Buffer.isBuffer(obj);
    }
    function isObject(obj) {
        return typeof obj === 'object' && !Array.isArray(obj) && obj !== null;
    }
    const stackOfKeyRefs = [obj];
    do {
        const nextObjectLayer = stackOfKeyRefs.pop();
        for (const key in nextObjectLayer) {
            if (!nextObjectLayer.hasOwnProperty(key)) {
                continue;
            }
            if (isObject(nextObjectLayer[key]) && !isBuffer(nextObjectLayer[key])) {
                stackOfKeyRefs.push(nextObjectLayer[key]);
            }
            else if (isBuffer(nextObjectLayer[key])) {
                if (utf8) {
                    nextObjectLayer[key + '-utf8'] = nextObjectLayer[key].toString('utf8');
                }
                nextObjectLayer[key] = nextObjectLayer[key].toString('hex');
            }
        }
    } while (stackOfKeyRefs.length);
    return obj;
}
exports.hexifyObjectWithUtf8 = hexifyObjectWithUtf8;
function expandDataDecoded(record, hexify = true, addUtf8 = false) {
    if (record && record.mint_info) {
        try {
            record.mint_info['data_decoded'] = decodePayloadCBOR(record.mint_info['data'], hexify, addUtf8);
        }
        catch (error) {
        }
    }
    return record;
}
exports.expandDataDecoded = expandDataDecoded;
function expandLocationInfo(record) {
    if (record && record.location_info_obj) {
        const location_info = record.location_info_obj;
        const locations = location_info.locations;
        const updatedLocations = [];
        for (const locationItem of locations) {
            let detectedAddress;
            try {
                detectedAddress = (0, address_helpers_1.detectScriptToAddressType)(locationItem.script);
            }
            catch (err) {
            }
            updatedLocations.push(Object.assign({}, locationItem, {
                address: detectedAddress
            }));
        }
        record.location_info_obj.locations = updatedLocations;
    }
    return record;
}
exports.expandLocationInfo = expandLocationInfo;
function expandMintBlockInfo(record) {
    if (record && record.mint_info) {
        let blockheader_info = undefined;
        if (record.mint_info.reveal_location_height &&
            record.mint_info.reveal_location_height > 0 &&
            record.mint_info.reveal_location_header &&
            record.mint_info.reveal_location_header !== '') {
            blockheader_info = __1.bitcoin.Block.fromHex(record.mint_info.reveal_location_header);
            blockheader_info.prevHash = blockheader_info.prevHash.reverse().toString('hex');
            blockheader_info.merkleRoot = blockheader_info.merkleRoot.reverse().toString('hex');
        }
        record.mint_info = Object.assign({}, record.mint_info, {
            reveal_location_address: (0, address_helpers_1.detectScriptToAddressType)(record.mint_info.reveal_location_script),
            blockheader_info
        });
    }
    return record;
}
exports.expandMintBlockInfo = expandMintBlockInfo;
function decorateAtomicals(records, addUtf8 = false) {
    return records.map((item) => {
        return decorateAtomical(item, addUtf8);
    });
}
exports.decorateAtomicals = decorateAtomicals;
function decorateAtomical(item, addUtf8 = false) {
    expandMintBlockInfo(item);
    expandLocationInfo(item);
    expandDataDecoded(item, true, addUtf8);
    return item;
}
exports.decorateAtomical = decorateAtomical;
// 2QwqwqWWqSWwwqws
/**
 * validates that the rules matches a valid format
 * @param object The object which contains the 'rules' field
 */
function validateSubrealmRulesObject(topobject) {
    if (!topobject || !topobject.subrealms) {
        throw new Error(`File path does not contain top level 'subrealms' object element`);
    }
    const object = topobject.subrealms;
    if (!object || !object.rules || !Array.isArray(object.rules) || !object.rules.length) {
        throw new Error(`File path does not contain top level 'rules' array element with at least one rule set`);
    }
    for (const ruleset of object.rules) {
        const regexRule = ruleset.p;
        const outputRulesMap = ruleset.o;
        const modifiedPattern = '^' + regexRule + '$';
        // Test that the regex is valid
        new RegExp(modifiedPattern);
        if (!regexRule) {
            throw new Error('Aborting invalid regex pattern');
        }
        for (const propScript in outputRulesMap) {
            if (!outputRulesMap.hasOwnProperty(propScript)) {
                continue;
            }
            const priceRuleObject = outputRulesMap[propScript];
            const priceRuleValue = priceRuleObject.v;
            const priceRuleTokenType = priceRuleObject['id'];
            if (priceRuleValue < 0) {
                throw new Error('Aborting minting because price is less than 0');
            }
            if (priceRuleValue > 100000000000) {
                throw new Error('Aborting minting because price is greater than 1000');
            }
            if (isNaN(priceRuleValue)) {
                throw new Error('Price is not a valid number');
            }
            if (priceRuleTokenType && !isAtomicalId(priceRuleTokenType)) {
                throw new Error('id parameter must be a compact atomical id: ' + priceRuleTokenType);
            }
            try {
                const result = (0, address_helpers_1.detectScriptToAddressType)(propScript);
            }
            catch (ex) {
                // Technically that means a malformed payment *could* possibly be made and it would work.
                // But it's probably not what either party intended. Therefore warn the user and bow out.
                throw new Error('Realm rule output format is not a valid address script. Aborting...');
            }
        }
    }
}
exports.validateSubrealmRulesObject = validateSubrealmRulesObject;
