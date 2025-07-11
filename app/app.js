/** 
 * @file app/app.js
 * @description core wrapper 
 */

import { Counter, RotatingArray } from "../lib/collection.js";
import Core from "./core.js";

export default class App extends Core {
    constructor(config, target) {
        super(config, target)
        this.stats = new Counter()
        this.history = new RotatingArray(10)
        this.errors = new RotatingArray(10)
        this.reportTimer = null
        this.on('result', ({ id, code, headers, bodySummary, phases }) => {
            let note = ''
            let quality = 1
            // TODO： check result
            if (code < 300 && code >= 200) {
                this.stats.inc('2xx')
            } else if (code < 500 && code >= 400) {
                this.stats.inc('4xx')
            } else if (code < 600 && code >= 500) {
                this.stats.inc('5xx')
            }
            this.history.push({ id, code, phases, note, quality })
        })

        this.on('start', () => {
            this.reportTimer = setInterval(() => this.report(), this.config.reportInterval || 1000)
        })

        this.on('error', (error, reqInfo) => {
            this.stats.inc('err')
            if (reqInfo) {
                const { id, url } = reqInfo;
                this.errors.push({ error: error.name, id, url, time: Date.now() })
            }
        })
    }

    report() {
        let tx = this.agent.http.trafficStats.sentBytes +
            this.agent.https.trafficStats.sentBytes
        let rx = this.agent.http.trafficStats.receivedBytes +
            this.agent.https.trafficStats.receivedBytes
        let r = `report ${tx}/${rx} --------------------\n` +
            ` alive: ${this.alive.length}` +
            `  2xx: ${this.stats.get('2xx')}` +
            `  4xx: ${this.stats.get('4xx')}` +
            `  5xx: ${this.stats.get('5xx')}` +
            `  err: ${this.stats.get('err')}\n` +
            ` list: ${this.alive.toString()}\n`
        for (let item of this.history) {
            if (item) {
                let { id, code, phases, note, quality } = item;
                r += ` ${id}: ${code} ${phases}ms ${note}\n`
            }
        }

        this.emit('report', r)
    }
}