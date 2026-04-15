fetch('http://localhost:3000/api/rio4')
  .then(r => r.json())
  .then(d => console.log("Lotes:", d.lotes?.length, "Ops:", d.opsOficina?.length))
  .catch(console.error);
