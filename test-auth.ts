import jwt from "jsonwebtoken";
const token = jwt.sign({ id: "1779260667457", role: "super_admin" }, process.env.JWT_SECRET || "iraq_rental_local_secret_key_123");
fetch("http://localhost:3000/api/data/contracts", { headers: { "Authorization": "Bearer " + token } })
  .then(r => r.json())
  .then(d => console.log("contracts count:", d.length))
  .catch(e => console.error(e));
fetch("http://localhost:3000/api/data/customers?userId=1779260667457", { headers: { "Authorization": "Bearer " + token } })
  .then(r => r.json())
  .then(d => console.log("customers count:", d.length))
  .catch(e => console.error(e));
