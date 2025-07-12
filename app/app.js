/** 
 * @file app/app.js
 * @description core wrapper 
 */

import { Counter, RotatingArray } from "../lib/collection.js";
import { adaptiveToFixed, readableBytes, headersObjectToString } from "../lib/helper.js";
import Core from "./core.js";

export default class App extends Core {
    constructor(config, target) {
        super(config, target)
        this.stats = new Counter()
        this.lastTrafficStats = {
            cpu: 0,
            tx: 0,
            rx: 0,
            req: 0,
            res: 0,
        }
        this.history = new RotatingArray(10)
        // this.errors = new RotatingArray(10)
        this.reportTimer = null
        this.on('result', ({ id, code, headers, bodySummary, phases }) => {
            let quality = 1
            let size = headers['content-length'] || bodySummary.length

            let { cdn } = checkHeaders(headers)
            let note = cdn === '?' ? '' : ('cdn:' + cdn)
            if (cdn === 'HIT') {
                quality *= 0.6
            }
            if (code < 300 && code >= 200) {
                this.stats.inc('2xx')
                quality *= 0.8
            } else if (code < 500 && code >= 400) {
                this.stats.inc('4xx')
                quality = 0
            } else if (code < 600 && code >= 500) {
                this.stats.inc('5xx')
            }


            this.history.push({ id, code, phases, size, note, quality })
        })

        this.on('start', () => {
            this.reportTimer = setInterval(() => this.report(), this.config.reportInterval || 1000)
        })

        this.on('error', (error, reqInfo) => {
            this.stats.inc('err')
            if (reqInfo) {
                const { id, url } = reqInfo;
                // this.errors.push({ error: error.name, id, url, time: Date.now() })
            }
        })
    }

    report() {
        let cpuUsage = process.cpuUsage()
        let cpu = cpuUsage.user + cpuUsage.system
        let mem = process.memoryUsage.rss()
        let { tx, rx, req, res } = this.trafficStats
        let cpup = (cpu - this.lastTrafficStats.cpu) / 10000
        let txp = tx - this.lastTrafficStats.tx
        let rxp = rx - this.lastTrafficStats.rx
        // let reqp = req - this.lastTrafficStats.req
        // let resp = res - this.lastTrafficStats.res
        let historyCount = 0
        let avgQuality = 0
        let r = `REPORT --------------------\n`
        for (let item of this.history) {
            if (item) {
                let { id, code, phases, size, note, quality } = item;
                if (historyCount < 10) {
                    r += ` ${id} - ${code}  ${adaptiveToFixed(phases / 1000)}s  ${readableBytes(size)}B  ${note}\n`
                }
                avgQuality += quality
                historyCount++;
            }
        }

        avgQuality = historyCount ? avgQuality / historyCount : 1

        r += ` cpu: ${adaptiveToFixed(cpup)}%  mem: ${readableBytes(mem)}B  net: ${readableBytes(Math.max(txp, rxp))}B/s\n` +
            ` req: ${readableBytes(req)}P  tx: ${readableBytes(tx)}B  rx: ${readableBytes(rx)}B  q: ${(avgQuality.toFixed(1))}\n` +
            ` alive: ${this.alive.length}` +
            `  2xx: ${this.stats.get('2xx')}` +
            `  4xx: ${this.stats.get('4xx')}` +
            `  5xx: ${this.stats.get('5xx')}` +
            `  err: ${this.stats.get('err')}\n` +
            ` list: ${this.alive.toString()}`
        this.emit('report', r)
        this.lastTrafficStats = { cpu, tx, rx, req, res }
    }
}


function checkHeaders(headersObj) {
    let cdn = '?'
    let headersString = headersObjectToString(headersObj)
    if (/cache.*?hit/i.test(headersString)) {
        cdn = 'HIT'
    }
    if (/cache.*?(miss|pass|dynamic)/i.test(headersString)) {
        cdn = 'MISS'
    }
    return { cdn }
}