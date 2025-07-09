/** 
 * @file app/app.js
 * @description core wrapper 
 */

import { RotatingArray } from "../lib/collection.js";
import Core from "./core.js";

export default class App extends Core {
    constructor(config, target) {
        super(config, target)
        this.history = new RotatingArray(10)
        this.errors = new RotatingArray(10)
        this.reportTimer = null
        this.on('result', ({ id, code, headers, bodySummary, phases }) => {
            let note =  ''
            let quality = 1
            // TODO： check result
            this.history.push({id, code, phases, note, quality})
        })

        this.on('start', ()=>{
            this.reportTimer = setInterval(()=>this.report(), this.config.reportInterval || 1000)
        })

        this.on('error', (error, reqInfo) => {
            if (reqInfo) {
                const { id, url } = reqInfo;
                this.errors.push({ error: error.name, id, url, time: Date.now() })
            }
        })
    }

    report(){
        this.emit('report', )
    }
}