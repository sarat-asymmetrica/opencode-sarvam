import { parse } from './csv_parser.mjs';

const testInput = 'name,age\nAlice,30\n"Bob, Jr",25';
console.log('Input:', JSON.stringify(testInput));

try {
    const result = parse(testInput);
    console.log('Result:', JSON.stringify(result));
} catch (error) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
}