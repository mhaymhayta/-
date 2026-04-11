const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxSJuxnqy7vbi7cMaRF-Dy2aHgkOHWTYZS93x5sAzG2cwc55pbRi3WOO1NbhpEoPf8O/exec";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  // รับชื่อจากทั้ง query string และ path
  let name = (req.query.name || req.query.q || "").trim();
  
  // decode ถ้ายังไม่ได้ decode
  try { name = decodeURIComponent(name); } catch(e) {}
  
  name = name.toLowerCase();
  
  if (!name) return res.status(200).send("กรุณาบอกชื่อร้านด้วยครับ");

  try {
    const [custRes, tierRes] = await Promise.all([
      fetch(`${APPS_SCRIPT_URL}?action=customers`),
      fetch(`${APPS_SCRIPT_URL}?action=tiers`)
    ]);
    const custData = await custRes.json();
    const tierData = await tierRes.json();

    const customers = custData.data || [];
    const tiers = tierData.data || [];

    // ค้นหาแบบ fuzzy
    const found = customers.find(c => {
      const n = (c.name || "").toLowerCase();
      return n.includes(name) || name.includes(n) || 
             n.replace(/\s/g,"").includes(name.replace(/\s/g,""));
    });

    if (!found) {
      return res.status(200).send(`ไม่พบลูกค้าชื่อ ${name} ในระบบครับ`);
    }

    const tier = tiers.find(t => t.id === found.tierId) || {};
    const prices = tier.prices || {};

    const priceLines = Object.entries(prices)
      .filter(([, v]) => Number(v) > 0)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([k, v]) => `${k} กิโลกรัม ราคา ${v} บาท`)
      .join(" ");

    const answer = priceLines
      ? `${found.name} ราคาแก๊ส ${priceLines}`
      : `${found.name} ยังไม่ได้ตั้งราคาครับ`;

    // ส่งกลับเป็น plain text เพื่อให้ Siri อ่านได้ง่าย
    return res.status(200).send(answer);

  } catch (err) {
    return res.status(200).send("เกิดข้อผิดพลาด กรุณาลองใหม่ครับ");
  }
}
