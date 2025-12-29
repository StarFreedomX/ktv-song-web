import * as dotenv from "dotenv";
dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.example' });
import { debugType,debugTypeArray } from '@/types'

export function logger(type: string, message: any) {
    const requestTime = Date.now();
    // hh:mm:ss
    const timeString = new Date(requestTime).toString().split(' ')[4];
    console.log(`[${timeString}] [${type}] ${message}`);
}

export class KTVLogger {
    private readonly debugNumber: number;
    constructor(debugLevel?: debugType) {
        // 如果外部没有传参，自动读取环境变量 DEBUG_MODE
        const defaultDebug: debugType = 'info';
        const debugEnv = debugLevel || (process.env.DEBUG_MODE as debugType);
        this.debugNumber = debugTypeArray.includes(debugEnv as debugType)
            ? debugTypeArray.indexOf(debugEnv as debugType)
            : debugTypeArray.indexOf(defaultDebug);
    }

    error = (...args: any[]) => this.debugNumber >= debugTypeArray.indexOf('error') && logger('error', args.map(formatMessage).join(' '));
    info = (...args: any[]) => this.debugNumber >= debugTypeArray.indexOf('info') && logger('info', ' '+args.map(formatMessage).join(' '));
    warn = (...args: any[]) => this.debugNumber >= debugTypeArray.indexOf('warn') && logger('warn', ' '+args.map(formatMessage).join(' '));
    debug = (...args: any[]) => this.debugNumber >= debugTypeArray.indexOf('debug') && logger('debug', args.map(formatMessage).join(' '));
}

function formatMessage(message: any) {
    return  typeof message === 'object'
        ? JSON.stringify(message, null, 2) // '2' 表示缩进空格数，增加可读性
        : message;
}
const ktvLogger = new KTVLogger();
export default ktvLogger;
