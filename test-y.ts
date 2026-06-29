import yahooFinance from 'yahoo-finance2';
async function test() {
  try {
    const quote = await yahooFinance.quote('NVDA');
    console.log(quote);
  } catch (err) {
    console.error("ERROR", err);
  }
}
test();
