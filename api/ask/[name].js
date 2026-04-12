const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxSJuxnqy7vbi7cMaRF-Dy2aHgkOHWTYZS93x5sAzG2cwc55pbRi3WOO1NbhpEoPf8O/exec";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "text/plain; charset=utf-8");

  // รับชื่อจากทั้ง path, query string และ POST body
  let name = "";
  
  if (req.method === "POST") {
    const body = req.body || {};
    name = (body.name || body.q || "").trim();
  }
  
  if (!name) {
    name = (req.query.name || req.query.q || "").trim();
  }
  
  // path parameter
  if (!name) {
    name = (req.query.name || "").trim();
  }

  try { name = decodeURIComponent(name); } catch(e) {}
  name = name.toLowerCase();

  if (!name) {
    res.status(200).end("กรุณาบอกชื่อร้านด้วยครับ");
    return;
  }

  try {
    const [custRes, tierRes] = await Promise.all([
      fetch(`${APPS_SCRIPT_URL}?action=customers`),
      fetch(`${APPS_SCRIPT_URL}?action=tiers`)
    ]);
    const custData = await custRes.json();
    const tierData = await tierRes.json();

    const customers = custData.data || [];
    const tiers = tierData.data || [];

    const found = customers.find(c => {
      const n = (c.name || "").toLowerCase();
      return n.includes(name) || name.includes(n) ||
             n.replace(/\s/g,"").includes(name.replace(/\s/g,""));
    });

    if (!found) {
      res.status(200).end("ไม่พบลูกค้าชื่อ " + name + " ในระบบครับ");
      return;
    }

    const tier = tiers.find(t => t.id === found.tierId) || {};
    const prices = tier.prices || {};

    const priceLines = Object.entries(prices)
      .filter(([, v]) => Number(v) > 0)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([k, v]) => k + " กิโลกรัม ราคา " + v + " บาท")
      .join(" ");

    const answer = priceLines
      ? found.name + " ราคาแก๊ส " + priceLines
      : found.name + " ยังไม่ได้ตั้งราคาครับ";

    res.status(200).end(answer);

  } catch (err) {
    res.status(200).end("เกิดข้อผิดพลาด กรุณาลองใหม่ครับ");
  }
}
