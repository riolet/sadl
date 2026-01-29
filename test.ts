// Test script to verify the parser works correctly

import { readFileSync } from 'fs';
import { parse } from './src/index.js';

const input = readFileSync('example.sadl', 'utf-8');
const ast = parse(input);

console.log(JSON.stringify(ast, null, 2));
