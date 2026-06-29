import YahooFinance from 'yahoo-finance2';
const yahooFinance = new YahooFinance();

async function test() {
  try {
    const q = await yahooFinance.quote('NVDA');
    console.log(q.regularMarketPrice);
  } catch(e) {
    console.error(e);
  }
}
test();
