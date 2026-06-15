const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxSJuxnqy7vbi7cMaRF-Dy2aHgkOHWTYZS93x5sAzG2cwc55pbRi3WOO1NbhpEoPf8O/exec";

// Cache ข้อมูลไว้ในหน่วยความจำ
let cache = null;
let cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 นาที

async function getData() {
  const now = Date.now();
  if (cache && (now - cacheTime) < CACHE_TTL) return cache;
  
  const [custRes, tierRes] = await Promise.all([
    fetch(`${APPS_SCRIPT_URL}?action=customers`),
    fetch(`${APPS_SCRIPT_URL}?action=tiers`)
  ]);
  const custData = await custRes.json();
  const tierData = await tierRes.json();
  
  cache = {
    customers: custData.data || [],
    tiers: tierData.data || []
  };
  cacheTime = now;
  return cache;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "text/plain; charset=utf-8");

  let name = (req.query.name || "").trim();
  try { name = decodeURIComponent(name); } catch(e) {}
  name = name.toLowerCase();

  if (!name) {
    res.status(200).end("กรุณาบอกชื่อร้านด้วยครับ");
    return;
  }

  try {
    const { customers, tiers } = await getData();

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

    // เอาเฉพาะขนาดถังที่ลูกค้ารายนี้ใช้จริง (จาก tanks)
    const ownedSizes = [...new Set((found.tanks || []).map(t => Number(t.size)))];

    let entries = Object.entries(prices)
      .filter(([k, v]) => ownedSizes.includes(Number(k)) && Number(v) > 0);

    // ถ้าไม่มี tanks ระบุไว้ ให้ fallback กลับไปอ่านทุกขนาดที่มีราคา
    if (entries.length === 0) {
      entries = Object.entries(prices).filter(([, v]) => Number(v) > 0);
    }

    const priceLines = entries
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
