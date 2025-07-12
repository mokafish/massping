/**
 * @file  cli/run.js
 * @description run app core
 */
import fs from 'fs/promises';
import winston from 'winston'
import App from '../app/app.js'

const consoleFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.colorize(),
    // winston.format.align(),                       
    winston.format.printf(({ level, message, timestamp }) => {
        return `[${timestamp.toString().substring(11, 19)}] ${level}: ${message}`
    })
)

const fileFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
)



/**
 * 
 * @param {typeof App.defaultConfig} config 
 * @param {string} target 
 */
export default async function run(config, target) {
    const logger = winston.createLogger({
        levels: {
            emerg: 0,
            alert: 1,
            crit: 2,
            error: 3,
            warning: 4,
            notice: 5,
            info: 6,
            debug: 7
        },
        transports: [
            new winston.transports.Console({
                format: consoleFormat,
                level: config.silent ? 'emerg' : (config.logLevel),

            }),
            // new winston.transports.File({
            //     filename: 'logs/combined.log',
            //     format: fileFormat,
            //     level: 'debug',
            // })
        ]
    });

    const app = new App(config, target)

    app.on('ready', () => {
        logger.info('ready')
    })

    app.on('error', (error, reqInfo) => {
        if (reqInfo) {
            const { id, url } = reqInfo;
            logger.error(`${error} (${id}) ${url}`);
        } else {
            logger.error(error)
        }
    })

    app.on('submit', ({ id, url }) => {
        logger.info(`submit ${id} -> ${url}`);
    })


    app.on('result', ({ id, code, headers, bodySummary, phases }) => {
        logger.info(`result ${id} <- ${code}, ${phases}ms`);
    })

    app.on('report', (report) => {
        logger.notice(report)
    })

    await app.init()
    app.start()
}