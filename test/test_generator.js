// test/generator.test.js
import test from 'ava';
import {
    seq,
    rand,
    choose,
    chooseFromFile,
    randText,
    product,
    power,
} from '../lib/generator.js';

// 测试 seq 函数
test('seq: basic sequence with step 1', t => {
    const next = seq(1, 3);
    t.deepEqual(next(), { value: 1, overflow: false });
    t.deepEqual(next(), { value: 2, overflow: false });
    t.deepEqual(next(), { value: 3, overflow: false });
    t.deepEqual(next(), { value: 1, overflow: true });  // 重置后首次返回起点
});

test('seq: step larger than range', t => {
    const next = seq(1, 5, 10);
    t.deepEqual(next(), { value: 1, overflow: false });
    t.deepEqual(next(), { value: 1, overflow: true });  // 立即重置
});


// 测试 rand 函数
test('rand: without countdown', t => {
    const next = rand(5, 10);
    const results = Array.from({ length: 100 }, next);

    // 验证所有值都在范围内
    t.true(results.every(({ value }) => value >= 5 && value <= 10));

    // 验证 overflow 始终为 true
    t.true(results.every(({ overflow }) => overflow));
});

test('rand: with countdown', t => {
    const next = rand(1, 3, 3);
    const results = [
        next(), // #1 overflow=false (count=3)
        next(), // #2 overflow=false (count=2)
        next(), // #3 overflow=false (count=1)
        next(), // #4 overflow=true (count reset to 3)
    ];

    t.is(results[0].overflow, false);
    t.is(results[1].overflow, false);
    t.is(results[2].overflow, false);
    t.is(results[3].overflow, true);
});

test('rand: with countdown is 0', t => {
    const next = rand(1, 3, 0);
    const results = [
        next(),
        next(), 
        next(),
        next(), 
    ];

    t.is(results[0].overflow, true);
    t.is(results[1].overflow, true);
    t.is(results[2].overflow, true);
    t.is(results[3].overflow, true);
});

test('rand: with countdown is 1', t => {
    const next = rand(1, 3, 1);
    const results = [
        next(), 
        next(), 
        next(), 
        next(), 
    ];

    t.is(results[0].overflow, false);
    t.is(results[1].overflow, true);
    t.is(results[2].overflow, true);
    t.is(results[3].overflow, true);
});

test('rand: with countdown < 0', t => {
    const next = rand(1, 3, -1);
    const results = [
        next(), 
        next(), 
        next(), 
        next(), 
    ];

    t.is(results[0].overflow, false);
    t.is(results[1].overflow, false);
    t.is(results[2].overflow, false);
    t.is(results[3].overflow, false);
});

// 测试 choose 函数
test('choose: orderly selection', t => {
    const next = choose(['A', 'B', 'C'], true);
    t.deepEqual(next(), { value: 'A', overflow: false });
    t.deepEqual(next(), { value: 'B', overflow: false });
    t.deepEqual(next(), { value: 'C', overflow: false });
    t.deepEqual(next(), { value: 'A', overflow: true }); // 循环后首次返回起点
});

test('choose: random selection', t => {
    const options = ['X', 'Y', 'Z'];
    const next = choose(options, false);

    // 验证100次选择都在选项范围内
    for (let i = 0; i < 100; i++) {
        const { value } = next();
        t.true(options.includes(value));
    }
});

test('choose: handles empty values', t => {
    const next = choose(['  ', '\t', 'valid'], true);
    t.deepEqual(next(), { value: 'valid', overflow: false });
    t.deepEqual(next(), { value: 'valid', overflow: true }); // 单元素循环
});

// 测试 randText 函数
test('randText: generates valid strings', t => {
    const chars = 'ABC123';
    const next = randText(chars, 3, 5);

    for (let i = 0; i < 50; i++) {
        const { value, overflow } = next();
        // 验证长度
        t.true(value.length >= 3 && value.length <= 5);
        // 验证字符
        t.true([...value].every(c => chars.includes(c)));
        // 验证 overflow
        t.true(overflow);
    }
});

// 场景1：任意值池为空时返回空结果且标记溢出
test('product: returns empty immediately if any pool is empty', t => {
  const ticker1 = product([[1, 2], []], '-');
  t.deepEqual(ticker1(), { value: '', overflow: true });

  const ticker2 = product([[], ['a']], null);
  t.deepEqual(ticker2(), { value: [], overflow: true });
});

// 场景2：无值池时返回空结果（字符串或数组）
test('product: handles no pools with string separator', t => {
  const ticker = product([], '-');
  t.deepEqual(ticker(), { value: '', overflow: false });
  t.deepEqual(ticker(), { value: '', overflow: true }); // 第二次调用标记溢出
});

test('product: handles no pools with array output', t => {
  const ticker = product([], null);
  t.deepEqual(ticker(), { value: [], overflow: false });
  t.deepEqual(ticker(), { value: [], overflow: true });
});

// 场景3：单值池的基本功能
test('product: single pool with string separator', t => {
  const ticker = product([['a', 'b']], '-');
  t.deepEqual(ticker(), { value: 'a', overflow: false });
  t.deepEqual(ticker(), { value: 'b', overflow: false });
  t.deepEqual(ticker(), { value: 'a', overflow: true }); // 循环回起点并标记溢出
});

test('product: single pool with array output', t => {
  const ticker = product([[10]], null);
  t.deepEqual(ticker(), { value: [10], overflow: false });
  t.deepEqual(ticker(), { value: [10], overflow: true });
});

// 场景4：多值池的组合逻辑
test('product: multiple pools with string separator', t => {
  const ticker = product([['x', 'y'], [1, 2]], '|');
  t.deepEqual(ticker(), { value: 'x|1', overflow: false });
  t.deepEqual(ticker(), { value: 'x|2', overflow: false });
  t.deepEqual(ticker(), { value: 'y|1', overflow: false });
  t.deepEqual(ticker(), { value: 'y|2', overflow: false });
  t.deepEqual(ticker(), { value: 'x|1', overflow: true }); // 循环回起点并标记溢出
});

test('product: multiple pools with array output', t => {
  const ticker = product([['a'], [true]], undefined);
  t.deepEqual(ticker(), { value: ['a', true], overflow: false });
  t.deepEqual(ticker(), { value: ['a', true], overflow: true });
});

// 场景5：溢出标记的正确性
test('product: correct overflow behavior after full cycle', t => {
  const ticker = product([[1], [2]], null);
  t.deepEqual(ticker(), { value: [1, 2], overflow: false }); // 首次调用无溢出
  t.deepEqual(ticker(), { value: [1, 2], overflow: true });  // 完成循环后标记溢出
  t.deepEqual(ticker(), { value: [1, 2], overflow: true });  // 后续持续标记溢出
});

// 场景6：非字符串分隔符返回数组
test('product: non-string separator returns arrays', t => {
  const ticker1 = product([[1], [2]], 123);
  t.deepEqual(ticker1(), { value: [1, 2], overflow: false });

  const ticker2 = product([['a']], false);
  t.deepEqual(ticker2(), { value: ['a'], overflow: false });
});

// ----------------------
// power() 测试用例
// ----------------------
test('power: 空输入应返回空结果', t => {
    const ticker = power('', 1, 3, null);
    const result = ticker();
    t.deepEqual(result, { value: [], overflow: true });
});

test('power: 单字符幂集应正确生成', t => {
    const ticker = power(['A'], 1, 2, '');
    const results = collectTicker(ticker, 4);
    
    t.deepEqual(results[0], { value: 'A', overflow: false });    // 1次幂
    t.deepEqual(results[1], { value: 'AA', overflow: false });   // 2次幂
    t.deepEqual(results[2], { value: 'A', overflow: true });     // 重置到1次幂
    t.deepEqual(results[3], { value: 'AA', overflow: false });   // 继续2次幂
});

test('power: 指数范围应正确迭代', t => {
    const ticker = power('AB', 2, 3, null);
    const results = collectTicker(ticker, 14);
    
    // 2次幂 (AA, AB, BA, BB)
    t.deepEqual(results[0], { value: ['A','A'], overflow: false });
    t.deepEqual(results[1], { value: ['A','B'], overflow: false });
    t.deepEqual(results[2], { value: ['B','A'], overflow: false });
    t.deepEqual(results[3], { value: ['B','B'], overflow: false });
    
    // 3次幂 (AAA, AAB, ...)
    t.deepEqual(results[4], { value: ['A','A','A'], overflow: false });
    t.deepEqual(results[5], { value: ['A','A','B'], overflow: false });
    t.deepEqual(results[6], { value: ['A','B','A'], overflow: false });
    t.deepEqual(results[7], { value: ['A','B','B'], overflow: false });
    t.deepEqual(results[8], { value: ['B','A','A'], overflow: false });
    t.deepEqual(results[9], { value: ['B','A','B'], overflow: false });
    t.deepEqual(results[10], { value: ['B','B','A'], overflow: false });
    t.deepEqual(results[11], { value: ['B','B','B'], overflow: false });
   
    
    // 重置回2次幂 (带溢出标志)
    t.deepEqual(results[12], { value: ['A','A'], overflow: true });
    t.deepEqual(results[13], { value: ['A','B'], overflow: false });
});

test('power: 溢出标志应在范围重置时设置', t => {
    const ticker = power('XY', 1, 1, '');
    const results = collectTicker(ticker, 4);
    
    t.false(results[0].overflow); // X
    t.false(results[1].overflow); // Y
    t.true(results[2].overflow);  // 重置后的X
    t.false(results[3].overflow); // Y
});

test('power: 字符串输入应正确处理', t => {
    const ticker = power('01', 1, 2, '');
    const results = collectTicker(ticker, 7);
    
    t.deepEqual(results[0], { value: '0', overflow: false });
    t.deepEqual(results[1], { value: '1', overflow: false });
    t.deepEqual(results[2], { value: '00', overflow: false });
    t.deepEqual(results[3], { value: '01', overflow: false });
    t.deepEqual(results[4], { value: '10', overflow: false });
    t.deepEqual(results[5], { value: '11', overflow: false });
    t.deepEqual(results[6], { value: '0', overflow: true }); // 重置到1次幂
});

// 辅助函数：收集所有结果
function collectTicker(ticker, count) {
    const results = [];
    for (let i = 0; i < count; i++) {
        results.push(ticker());
    }
    return results;
}