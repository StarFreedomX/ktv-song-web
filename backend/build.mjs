import * as esbuild from 'esbuild';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const pkg = require('./package.json');
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const external = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.peerDependencies || {}),
    'node:path', 'node:fs', 'node:http'
];

async function run() {
    await esbuild.build({
        entryPoints: ['src/index.ts'],
        bundle: true,
        platform: 'node',
        target: 'node18',
        outfile: 'lib/index.js',
        format: 'cjs',
        sourcemap: true,
        external: external,
        alias: {
            '@': path.resolve(__dirname, './src')
        },
    });

    console.log('Successfully build to lib/');
}

run().catch(() => process.exit(1));
