const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxSJuxnqy7vbi7cMaRF-Dy2aHgkOHWTYZS93x5sAzG2cwc55pbRi3WOO1NbhpEoPf8O/exec";

let cache = null;
let cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000;

async function getData() {
  const now = Date.now();
  if (cache && (now - cacheTime) < CACHE_TTL) return cache;
  const [custRes, tierRes] = await Promise.all([
    fetch(`${APPS_SCRIPT_URL}?action=customers`),
    fetch(`${APPS_SCRIPT_URL}?action=tiers`)
  ]);
  const custData = await custRes.json();
  const tierData = await tierRes.json();
  cache = { customers: custData.data || [], tiers: tierData.data || [] };
  cacheTime = now;
  return cache;
}

function consonantSkeleton(s) {
  return (s || "").replace(/[\u0E30-\u0E3A\u0E40-\u0E45\u0E47-\u0E4E]/g, "");
}

function getPriceText(customer, tiers) {
  const tier = tiers.find(t => t.id === customer.tierId) || {};
  const prices = tier.prices || {};
  const ownedSizes = [...new Set((customer.tanks || []).map(t => Number(t.size)))];
  
  let entries = Object.entries(prices)
    .filter(([k, v]) => ownedSizes.includes(Number(k)) && Number(v) > 0);
  
  if (entries.length === 0) {
    entries = Object.entries(prices).filter(([, v]) => Number(v) > 0);
  }
  
  return entries
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([k, v]) => `${k} กิโลกรัม ราคา ${v} บาท`)
    .join(" ");
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "text/plain; charset=utf-8");

  let name = (req.query.name || "").trim();
  try { name = decodeURIComponent(name); } catch(e) {}
  name = name.toLowerCase();

  // แก้คำที่ Siri มักจับผิด
  const corrections = {
    "ก๋วยเดี๋ยว": "ก๋วยเตี๋ยว",
    "ก๋วยเตียว": "ก๋วยเตี๋ยว",
    "กวยเตียว": "ก๋วยเตี๋ยว",
    "กวยเดียว": "ก๋วยเตี๋ยว",
    "ครัวนางทราย": "ครัวนางทราย",
    "จิ้มจุ่ม": "จิ้มจุ่ม",
  };
  if (corrections[name]) name = corrections[name];

  if (!name) {
    res.status(200).end("กรุณาบอกชื่อร้านด้วยครับ");
    return;
  }

  try {
    const { customers, tiers } = await getData();

    const nameNoSpace = name.replace(/\s/g, "");
    const nameSkel = consonantSkeleton(nameNoSpace);

    // เช็คว่ามีร้านที่ตรงกันเป๊ะมั้ย (exact match)
    const exactMatch = customers.find(c => {
      const n = (c.name || "").toLowerCase();
      const nNoSpace = n.replace(/\s/g, "");
      return n === name || nNoSpace === nameNoSpace;
    });

    // ถ้าตรงเป๊ะ → ใช้ร้านนั้นเลย ไม่ต้องหาอื่น
    if (exactMatch) {
      const priceText = getPriceText(exactMatch, tiers);
      const answer = priceText
        ? `${exactMatch.name} ราคาแก๊ส ${priceText}`
        : `${exactMatch.name} ยังไม่ได้ตั้งราคาครับ`;
      res.status(200).end(answer);
      return;
    }

    const found = customers.filter(c => {
      const n = (c.name || "").toLowerCase();
      const nNoSpace = n.replace(/\s/g, "");
      if (n.includes(name) || nNoSpace.includes(nameNoSpace)) return true;
      if (nameSkel.length >= 2) {
        const nSkel = consonantSkeleton(nNoSpace);
        if (nSkel.includes(nameSkel) || nameSkel.includes(nSkel)) return true;
      }
      return false;
    });

    if (found.length === 0) {
      res.status(200).end("ไม่พบลูกค้าชื่อ " + name + " ในระบบครับ");
      return;
    }

    if (found.length === 1) {
      const c = found[0];
      const priceText = getPriceText(c, tiers);
      const answer = priceText
        ? `${c.name} ราคาแก๊ส ${priceText}`
        : `${c.name} ยังไม่ได้ตั้งราคาครับ`;
      res.status(200).end(answer);
      return;
    }

    // หลายร้าน — อ่านทุกร้าน
    const lines = found.map((c, i) => {
      const priceText = getPriceText(c, tiers);
      return priceText
        ? `ร้านที่ ${i+1} ${c.name} ราคา ${priceText}`
        : `ร้านที่ ${i+1} ${c.name} ยังไม่ได้ตั้งราคา`;
    });

    const answer = `พบ ${found.length} ร้าน ` + lines.join(" ... ");
    res.status(200).end(answer);

  } catch (err) {
    res.status(200).end("เกิดข้อผิดพลาด กรุณาลองใหม่ครับ");
  }
}
