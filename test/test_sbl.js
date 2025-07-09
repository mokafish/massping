import util from 'util';
import test from 'ava';
import { Lexer, Parser, SBL } from '../lib/sbl.js';

util.inspect.defaultOptions.depth = 5;  // Increase AVA's printing depth

test('Lexer', async t => {
    const lexer = new Lexer();
    const tokens = lexer.tokenize(
        `hello {exec abc "x y z"} ... , {"exec 2" 'ab\\'c' x="\\{ 123 \\}"} world...`
    );
    // t.log(tokens);
    t.snapshot(tokens, 'Lexer #1');
});

test('Parser - this.parse()', async t => {
    const lexer = new Lexer();
    const parser = new Parser();

    let tokens = lexer.tokenize(
        `hello {"exec 2" #1 ^g:2 abc "x y z = 789"  x="\\{ 123 \\}" "y z"="4 5\ 6"}  world...`
    );
    let ast = parser.parse(tokens);
    // t.log(ast)
    t.snapshot(ast, 'Parser parse() #1');

    tokens = lexer.tokenize('.../q={xxx}&i={1:5}&s={ yyy }&d={"z\\"z}z"}');
    ast = parser.parse(tokens);
    // t.log(ast);
    t.snapshot(ast, 'Parser parse() #2');
});

test('Parser - syntax', async t => {
    t.timeout(10000); // Increase timeout for this test
    const lexer = new Lexer();
    const parser = new Parser();

    let tokens = lexer.tokenize('.../q={1:5}');
    let ast = parser.parse(tokens);
    t.is(ast[1].opcode, 'seq');
    t.deepEqual(ast[1].data, [1, 5, 1]);

    tokens = lexer.tokenize('.../q={1:5:-1}');
    ast = parser.parse(tokens);
    t.is(ast[1].opcode, 'seq');
    t.deepEqual(ast[1].data, [1, 5, -1]);

    tokens = lexer.tokenize('.../q={1:}');
    ast = parser.parse(tokens);
    t.is(ast[1].opcode, 'seq');
    t.deepEqual(ast[1].data, [1, Number.MAX_SAFE_INTEGER, 1]);

    tokens = lexer.tokenize('.../q={:20}');
    ast = parser.parse(tokens);
    t.is(ast[1].opcode, 'seq');
    t.deepEqual(ast[1].data, [0, 20, 1]);

    tokens = lexer.tokenize('r={zh,en,ja}');
    ast = parser.parse(tokens);
    t.is(ast[1].opcode, 'choose');
    t.deepEqual(ast[1].data, [['zh', 'en', 'ja'], true]);

    tokens = lexer.tokenize('r={"help:edit|t:apple(company)|x\\ p"}');
    ast = parser.parse(tokens);
    t.is(ast[1].opcode, 'choose');
    t.deepEqual(ast[1].data, [['help:edit', 't:apple(company)', 'x p',], false,]);

});

test('Parser - preprocess', async t => {
    const parser = new Parser();
    let ast = parser.parse('... q={:5 ^1 #apple} w={#doc:7} e={#3} r={20:30 ^doc:9}', 'main');
    // t.log(ast);
    t.snapshot(ast, 'Parser - preprocess #1');
})

test('SBL - throw if unhoped loading', async t => {
    let interpreter = new SBL();
    interpreter.load('... q={:5}');
    interpreter.ready();
    t.throws(() => {
        interpreter.load('... q={:20}', 'doc');
    }, { message: 'Interpreter is readied. Stop load inputs.' });
})

test('SBL - throw if circular reference', async t => {
    let interpreter = new SBL();
    interpreter.load('... q={:5 ^1} w={20: ^2} e={3:9 ^0}');
    t.throws(() => {
        interpreter.ready();
    }, { instanceOf: SBL.InterpreterError, message: 'Circular references exist between tags.' });
})

test('SBL - reference', async t => {
    const interpreter = new SBL();
    interpreter.load('... q={:5} w={#0} e={#3} r={20:29}');
    interpreter.ready();
    // t.log(interpreter.runtime.heap);
    let actual = []
    let o;
    for (let i = 0; i < 15; i++) {
        o = interpreter.execute();
        // t.log(`${i}`.padStart(2), o.main);
        actual.push(o.main);
    }

    let expected = [
        '... q=0 w=0 e=20 r=20',
        '... q=1 w=1 e=21 r=21',
        '... q=2 w=2 e=22 r=22',
        '... q=3 w=3 e=23 r=23',
        '... q=4 w=4 e=24 r=24',
        '... q=5 w=5 e=25 r=25',
        '... q=0 w=0 e=26 r=26',
        '... q=1 w=1 e=27 r=27',
        '... q=2 w=2 e=28 r=28',
        '... q=3 w=3 e=29 r=29',
        '... q=4 w=4 e=20 r=20',
        '... q=5 w=5 e=21 r=21',
        '... q=0 w=0 e=22 r=22',
        '... q=1 w=1 e=23 r=23',
        '... q=2 w=2 e=24 r=24',
    ]

    t.deepEqual(actual, expected);
})

test('SBL - pow', async t => {
    let interpreter = new SBL();
    interpreter.load('--'
        + ' q={1:3 ^1}'
        + ' w={11:33:11 ^2}'
        + ' e={111:333:111 ^3}'
        + ' r={1111:3333:1111}'
        + ' t={111:333:111 ^3}'
        + ' y={11:33:11 ^2}'
        + ' u={1:3 ^1}'
    );
    interpreter.ready();
    // t.log(interpreter.runtime.heap);
    let actual = []
    let o;
    for (let i = 0; i < 100; i++) {
        o = interpreter.execute();
        // t.log(`${i}`.padStart(2), o.main);
        actual.push(o.main);
    }

    t.snapshot(actual, 'SBL - pow #1');

    interpreter = new SBL();
    interpreter.load('.../uploas/{2020:2025 ^1}/{1:12 ^2}/{1:31}');
    interpreter.ready();
    // t.log(interpreter.runtime.heap);
    actual = []
    o;
    for (let i = 0; i < 1000; i++) {
        o = interpreter.execute();
        // t.log(`${i}`.padStart(2), o.main);
        actual.push(o.main);
    }

    t.snapshot(actual, 'SBL - pow #2');

})

test('SBL - power text', async t => {
    const interpreter = new SBL();
    interpreter.load('/login?username={root,admin ^1}&password={d2:3}', 'url');
    interpreter.ready();
    for (let i = 0; i < 100; i++) {
        let url = interpreter.execute().url;
        t.is(url, `/login?username=root&password=${i.toString().padStart(2, '0')}`)
    }
    for (let i = 0; i < 1000; i++) {
        let url = interpreter.execute().url;
        t.is(url, `/login?username=root&password=${i.toString().padStart(3, '0')}`)
    }
    for (let i = 0; i < 100; i++) {
        let url = interpreter.execute().url;
        t.is(url, `/login?username=admin&password=${i.toString().padStart(2, '0')}`)
    }
    for (let i = 0; i < 1000; i++) {
        let url = interpreter.execute().url;
        t.is(url, `/login?username=admin&password=${i.toString().padStart(3, '0')}`)
    }
    for (let i = 0; i < 100; i++) {
        let url = interpreter.execute().url;
        t.is(url, `/login?username=root&password=${i.toString().padStart(2, '0')}`)
    }
})


test('SBL - some', async t => {
    let code = '... q={:5 ^1} w={10-100-3} e={:3 ^3} r={zh,en,} {t=true|||t=true}'
    code = '... x={Choose:fruits.txt encoding=url}, y={choose:fruits.txt}'
    code = '... t={ts} m={ms}'
    code = '... username={w5-16} password={t8-32}'
    code = '... username={root,admin ^1} password={d2:3}'

    const interpreter = new SBL();
    interpreter.load(code);
    interpreter.ready();
    // t.log(interpreter.runtime.heap);
    let o;
    for (let i = 0; i < 15; i++) {
        o = interpreter.execute();
        t.log(`${i}`.padStart(2), o.main);
    }
    t.pass();
})