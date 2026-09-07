async function testNadoPost() {
  const urls = [
    'https://api.prod.nado.xyz/gateway/v1/query',
    'https://api.test.nado.xyz/gateway/v1/query'
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'market_depth', product_id: 1 })
      });
      console.log(`POST ${url} (market_depth) -> Status: ${res.status}`);
      const data = await res.json();
      console.log('Data:', JSON.stringify(data).substring(0, 300));
    } catch (e) {
      console.log(`POST ${url} Error:`, e.message);
    }
  }
}

testNadoPost();
