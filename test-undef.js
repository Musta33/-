async function test() {
  const res = await fetch('http://localhost:3000/api/data/companies/undefined');
  console.log(res.status, await res.text());
}
test();
