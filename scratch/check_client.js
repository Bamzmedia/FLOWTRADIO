async function main() {
  const code = await fetch('https://unpkg.com/@vertex-protocol/contracts/dist/utils/index.js').then(r => r.text());
  console.log('utils index:\n', code);
}
main().catch(console.error);
