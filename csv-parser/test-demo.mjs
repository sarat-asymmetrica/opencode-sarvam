import { parse } from './csv_parser.mjs';
console.log(JSON.stringify(parse('name,age\nAlice,30\n"Bob, Jr",25')));