/**
 * @file lib/generator.js
 * @description some generators
 */

import { randomUUID } from 'crypto';
import fs from 'fs';
import { spawnSync, execSync } from 'child_process';
import { trimFalsy } from './helper.js';

/**
 * @callback Ticker
 * @returns {{ value: any, overflow: boolean }}
 */

/**
 * Creates a sequence generator that produces values from `start` to `end` with a specified `step`.
 * When the sequence overflows, it wraps around to the start.
 *
 * @param {number} start - The starting value of the sequence.
 * @param {number} end - The ending value of the sequence (inclusive).
 * @param {number} step - The step size for each iteration.
 * @returns {Ticker} A function that returns the next value in the sequence and whether it overflowed.
 */
export function seq(start, end = Number.MAX_SAFE_INTEGER, step = 1) {
    let current = start;
    let nextOverflow = false;  // 标记下一次调用是否应返回overflow

    return function () {
        const value = current;
        const overflow = nextOverflow;

        // 计算下一个值并检查是否需要重置
        let next = current + step;
        nextOverflow = false;
        if (next > end) {
            next = start;
            nextOverflow = true;
        }
        current = next;

        return { value, overflow };
    };
}

/**
 * 
 * @param {number} min - The min value 
 * @param {number} max - The max value  (inclusive).
 * @param {number} countdown - set overflow at after the countdown is completed
 * @returns {Ticker} A function that returns the next value in the random and whether it overflowed.
 */export function rand(min, max, countdown) {
    let count = 0;
    return () => {
        let value = Math.floor(Math.random() * (max + 1 - min)) + min;
        let overflow = true;

        if (countdown) {
            overflow = (count === countdown);
            count = overflow ? 1 : count + 1;
        }

        return { value, overflow };
    };
}

export function choose(values, orderly) {
    // const pool = values.filter(Boolean).map(v => v.trim());
    const pool = trimFalsy(values.map(v => v.trim()));
    const tick = orderly
        ? seq(0, pool.length - 1)
        : rand(0, pool.length - 1, pool.length)
    return () => {
        let x = tick()
        let value = pool[x.value]
        let overflow = x.overflow
        return { value, overflow }
    }
}

export function chooseFromFile(file, orderly) {
    const lines = fs.readFileSync(file, 'utf-8').trim().split('\n')
    return choose(lines, orderly)
}

export function randText(chars, minLength, maxLength) {
    const ntick = rand(minLength, maxLength)
    const itick = rand(0, chars.length - 1)
    return () => {
        let arr = Array(ntick().value)
        for (let i = 0; i < arr.length; i++) {
            arr[i] = chars[itick().value]
        }
        return { value: arr.join(''), overflow: true }
    }
}

export function time(secondsUnit = false) {
    return secondsUnit
        ? (() => ({ value: parseInt(Date.now() / 1000), overflow: true }))
        : () => ({ value: Date.now(), overflow: true })
}

/**
 * 
 * @param  {Iterable<Iterable>} iterables 
 * @param  {string|null} separator 
 * @returns {Ticker} 
 */
export function product(iterables, separator) {
    // 如果任意集合为空，则笛卡尔积为空，返回恒定的空数据
    if (iterables.some(iterable => iterable.length === 0)) {
        return function ticker() {
            return { value: typeof separator == 'string' ? '' : [], overflow: true };
        };
    }

    // 初始化每个维度的索引（全0）和下次溢出的标志
    let indices = iterables.map(() => 0);
    let nextOverflow = false;

    return () => {
        // 根据当前索引获取各维度的值组成当前组合
        const value = iterables.map((iterable, i) => iterable[indices[i]]);
        const overflow = nextOverflow;  // 本次返回的溢出标志是上次设置的
        nextOverflow = false;          // 重置为false，准备计算下次状态

        // 进位更新：从最后一个维度开始向前进位
        let carry = 1;
        for (let i = indices.length - 1; i >= 0; i--) {
            if (carry === 0) break;  // 无进位时提前终止循环

            indices[i] += carry;     // 当前维度加进位
            carry = 0;               // 清除进位

            // 检查是否超出当前维度的值池大小
            if (indices[i] >= iterables[i].length) {
                indices[i] = 0;      // 重置当前维度索引
                carry = 1;           // 设置向前维度的进位
            }
        }

        // 若最终仍有进位（所有维度都已重置），则设置下次溢出标志
        if (carry === 1) {
            nextOverflow = true;
        }

        return {
            value: typeof separator == 'string'
                ? value.join(separator)
                : value,
            overflow
        };
    };
}

/**
 * Creates a generator for the Cartesian power of an iterable, producing all combinations from `startExponent` to `endExponent`.
 * When the last combination of the highest exponent is produced, the next call wraps around to the first combination of the start exponent and sets the overflow flag.
 *
 * @param {Iterable} iterable - The input iterable (e.g., string or array).
 * @param {number} startExponent - The starting exponent (inclusive).
 * @param {number} endExponent - The ending exponent (inclusive).
 * @param {string|null} separator - If a string, combinations are joined by this separator; otherwise, arrays are returned.
 * @returns {Ticker} A function that returns the next combination and whether it overflowed (due to reset).
 */
export function power(iterable, startExponent, endExponent, separator) {
    // Convert iterable to an array to handle strings and check length
    const length = iterable.length;

    // Handle empty iterable: return constant empty value with overflow=true
    if (length === 0) {
        return () => {
            return {
                value: typeof separator === 'string' ? '' : [],
                overflow: true
            };
        };
    }

    let currentExponent = startExponent;
    // Create initial product ticker for the start exponent
    let currentTicker = product(Array(currentExponent).fill(iterable), separator);

    let nextOverflow = false; // Tracks if the next call should return overflow=true (for reset)

    return function ticker() {
        // Save overflow flag for this call and reset nextOverflow
        let overflow = nextOverflow;
        nextOverflow = false;

        // Get the next combination from the current exponent's product
        let result = currentTicker();

        // If the current exponent's product overflowed (all combinations generated)
        if (result.overflow) {
            currentExponent++; // Move to next exponent
            if (currentExponent > endExponent) {
                // Reset to start exponent and mark that this call is a reset
                currentExponent = startExponent;
                overflow = true; // This call returns overflow=true due to reset
            }
            // Create new product ticker for the new exponent
            currentTicker = product(Array(currentExponent).fill(iterable), separator);
            // Get the first combination of the new exponent
            result = currentTicker();
        }

        return {
            value: result.value,
            overflow,
        };
    };
}

