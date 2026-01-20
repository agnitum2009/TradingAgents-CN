/**
 * Test TypeScript services
 */

require('reflect-metadata');

const tsServices = require('./build/index.js');

console.log('=== TypeScript Services Test ===');
console.log('SUCCESS: TypeScript services loaded!');
console.log('Exports count:', Object.keys(tsServices).length);
console.log('Exports:', Object.keys(tsServices));
console.log('==========================');
