const kra_pins = ["P051561163Z", "P051561480D", "P051561903T"];
const type = "suppliers";

const requests = kra_pins.map(kra_pin => {
    const url = `https://primary-production-079f.up.railway.app/webhook-test/manufucturerDetails?kra_pin=${encodeURIComponent(kra_pin)}&type=${encodeURIComponent(type)}`;
    
    return fetch(url)
      .then(res => res.json())
      .then(data => ({ kra_pin, success: true, data }))
      .catch(error => ({ kra_pin, success: false, error }));
  });
  
  Promise.all(requests)
    .then(results => {
      console.log("All Results:", results);
    });