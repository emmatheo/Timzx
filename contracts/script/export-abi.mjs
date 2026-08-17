// Extracts the ABIs the frontend needs from Foundry build output into typed TS modules.
// Run after `forge build` so the frontend can never drift from the compiled contracts.
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '..', 'out');
const target = join(here, '..', '..', 'web', 'src', 'lib', 'abi');

const contracts = [
  ['TradeFinance', 'TradeFinance.sol'],
  ['CollateralVault', 'CollateralVault.sol'],
  ['TradeEscrow', 'TradeEscrow.sol'],
  ['RepaymentManager', 'RepaymentManager.sol'],
  ['DemoAttestationAdapter', 'DemoAttestationAdapter.sol'],
  ['UscAttestationAdapter', 'UscAttestationAdapter.sol'],
  ['TestnetFaucet', 'TestnetFaucet.sol'],
  ['TestUSD', 'TestUSD.sol'],
  ['TradeEventEmitter', 'TradeEventEmitter.sol'],
];

mkdirSync(target, {recursive: true});

const index = [];
for (const [name, file] of contracts) {
  const artifact = JSON.parse(readFileSync(join(outDir, file, `${name}.json`), 'utf8'));
  const varName = `${name.charAt(0).toLowerCase()}${name.slice(1)}Abi`;
  const body = `// Generated from contracts/out/${file}/${name}.json by script/export-abi.mjs.
// Do not edit by hand; run \`node script/export-abi.mjs\` from contracts/ after changing the Solidity.
export const ${varName} = ${JSON.stringify(artifact.abi, null, 2)} as const;
`;
  writeFileSync(join(target, `${name}.ts`), body);
  index.push(`export {${varName}} from './${name}';`);
}

writeFileSync(join(target, 'index.ts'), `${index.join('\n')}\n`);
console.log(`wrote ${contracts.length} ABIs to web/src/lib/abi`);
