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
        logger.debug(`submit ${id}, ${url}`);
    })


    app.on('result', ({ id, code, headers, bodySummary, phases }) => {
        logger.debug(`result ${id}), ${code}, ${phases}ms`);
    })

    app.on('report', (report) => {
        logger.info(report)
    })

    await app.init()
    app.start()
}