import { Protocol } from 'trac-peer'
import b4a from 'b4a'
import { bufferToBigInt, bigIntToDecimalString } from 'trac-msb/src/utils/amountSerialization.js'
import PeerWallet from 'trac-wallet'
import fs from 'fs'

const stableStringify = (value) => {
    if (value === null || value === undefined) return 'null'
    if (typeof value !== 'object') return JSON.stringify(value)
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
    const keys = Object.keys(value).sort()
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`
}

class TaskBoardProtocol extends Protocol {

    constructor (peer, base, options = {}) {
        super(peer, base, options)
    }

    mapTxCommand (command) {
        const obj = { type: '', value: null }
        const json = this.safeJsonParse(command)

        if (json && json.op) {
            switch (json.op) {
                case 'task_post':   obj.type = 'task_post';   obj.value = json; return obj
                case 'task_list':   obj.type = 'task_list';   obj.value = json; return obj
                case 'task_get':    obj.type = 'task_get';    obj.value = json; return obj
                case 'task_claim':  obj.type = 'task_claim';  obj.value = json; return obj
                case 'task_submit': obj.type = 'task_submit'; obj.value = json; return obj
                case 'task_accept': obj.type = 'task_accept'; obj.value = json; return obj
                case 'task_reject': obj.type = 'task_reject'; obj.value = json; return obj
                case 'task_cancel': obj.type = 'task_cancel'; obj.value = json; return obj
            }
        }

        return null
    }

    async printOptions () {
        console.log(' ')
        console.log('- TaskBoard Commands:')
        console.log('- /tx --command \'{ "op": "task_post", "title": "<title>", "description": "<desc>", "reward": "<reward>", "tags": "<csv>" }\'')
        console.log('- /tx --command \'{ "op": "task_list", "status": "open|claimed|submitted|done|cancelled|all" }\'')
        console.log('- /tx --command \'{ "op": "task_get", "task_id": 1 }\'')
        console.log('- /tx --command \'{ "op": "task_claim", "task_id": 1 }\'')
        console.log('- /tx --command \'{ "op": "task_submit", "task_id": 1, "result": "<work>" }\'')
        console.log('- /tx --command \'{ "op": "task_accept", "task_id": 1 }\'')
        console.log('- /tx --command \'{ "op": "task_reject", "task_id": 1, "reason": "<feedback>" }\'')
        console.log('- /tx --command \'{ "op": "task_cancel", "task_id": 1 }\'')
        console.log('- /get --key "<key>" | read contract state directly')
        console.log('- /msb | show MSB info and balance')
    }

    async customCommand (input) {
        await super.tokenizeInput(input)

        if (this.input.startsWith('/get')) {
            const m = input.match(/(?:^|\s)--key(?:=|\s+)(\"[^\"]+\"|'[^']+'|\S+)/)
            const raw = m ? m[1].trim() : null
            if (!raw) {
                console.log('Usage: /get --key "<key>"')
                return
            }
            const key = raw.replace(/^\"(.*)\"$/, '$1').replace(/^'(.*)'$/, '$1')
            const confirmedMatch = input.match(/(?:^|\s)--confirmed(?:=|\s+)(\S+)/)
            const unconfirmedMatch = input.match(/(?:^|\s)--unconfirmed(?:=|\s+)?(\S+)?/)
            const confirmed = unconfirmedMatch ? false : confirmedMatch ? confirmedMatch[1] === 'true' || confirmedMatch[1] === '1' : true
            const v = confirmed ? await this.getSigned(key) : await this.get(key)
            console.log(v)
            return
        }

        if (this.input.startsWith('/msb')) {
            const txv = await this.peer.msbClient.getTxvHex()
            const peerMsbAddress = this.peer.msbClient.pubKeyHexToAddress(this.peer.wallet.publicKey)
            const entry = await this.peer.msbClient.getNodeEntryUnsigned(peerMsbAddress)
            const balance = entry?.balance ? bigIntToDecimalString(bufferToBigInt(entry.balance)) : 0
            const feeBuf = this.peer.msbClient.getFee()
            const fee = feeBuf ? bigIntToDecimalString(bufferToBigInt(feeBuf)) : 0
            const validators = this.peer.msbClient.getConnectedValidatorsCount()
            console.log({
                txv,
                msbSignedLength: this.peer.msbClient.getSignedLength(),
                connectedValidators: validators,
                peerMsbAddress,
                peerMsbBalance: balance,
                msbFee: fee,
            })
            return
        }

        if (this.input.startsWith('/print')) {
            const splitted = this.parseArgs(input)
            console.log(splitted.text)
        }
    }
}

export default TaskBoardProtocol