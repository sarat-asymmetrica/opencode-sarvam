import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { parse } from './csv_parser.mjs';

test('parses simple unquoted row', () => {
    assert.deepEqual(parse('a,b,c'), [['a', 'b', 'c']]);
});

test('parses multiple rows separated by newline', () => {
    assert.deepEqual(parse('a,b,c\nd,e,f'), [['a', 'b', 'c'], ['d', 'e', 'f']]);
});

test('parses quoted cell containing comma', () => {
    assert.deepEqual(parse('a,"b,c",d'), [['a', 'b,c', 'd']]);
});

test('parses quoted cell containing newline', () => {
    assert.deepEqual(parse('a,"b\nc",d'), [['a', 'b\nc', 'd']]);
});

test('parses escaped quote inside quoted cell', () => {
    assert.deepEqual(parse('a,"he said ""hi""",b'), [['a', 'he said "hi"', 'b']]);
});

test('parses empty cells', () => {
    assert.deepEqual(parse('a,,b'), [['a', '', 'b']]);
});

test('skips empty rows', () => {
    assert.deepEqual(parse('a,b\n\nc,d'), [['a', 'b'], ['c', 'd']]);
});

test('ignores trailing newline', () => {
    assert.deepEqual(parse('a,b\n'), [['a', 'b']]);
});

test('returns empty array for empty input', () => {
    assert.deepEqual(parse(''), []);
});

test('throws on unclosed quoted cell', () => {
    assert.throws(() => parse('a,"unclosed,b'), /Unclosed quoted cell/);
});