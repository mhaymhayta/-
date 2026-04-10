const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxSJuxnqy7vbi7cMaRF-Dy2aHgkOHWTYZS93x5sAzG2cwc55pbRi3WOO1NbhpEoPf8O/exec";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const name = (req.query.name || "").trim().toLowerCase();
  if (!name) return res.status(400).json({ answer: "กรุณาระบุชื่อร้านด้วยครับ" });

  try {
    // โหลดข้อมูลลูกค้าและ Tier
    const [custRes, tierRes] = await Promise.all([
      fetch(`${APPS_SCRIPT_URL}?action=customers`),
      fetch(`${APPS_SCRIPT_URL}?action=tiers`)
    ]);
    const custData = await custRes.json();
    const tierData = await tierRes.json();

    const customers = custData.data || [];
    const tiers = tierData.data || [];

    // ค้นหาลูกค้า (fuzzy match)
    const found = customers.find(c =>
      (c.name || "").toLowerCase().includes(name) ||
      name.includes((c.name || "").toLowerCase())
    );

    if (!found) {
      return res.status(200).json({ answer: `ไม่พบลูกค้าชื่อ ${name} ในระบบครับ` });
    }

    // หา Tier
    const tier = tiers.find(t => t.id === found.tierId) || {};
    const prices = tier.prices || {};

    // สร้างข้อความตอบกลับ
    const priceLines = Object.entries(prices)
      .filter(([, v]) => Number(v) > 0)
      .map(([k, v]) => `${k} กก ราคา ${v} บาท`)
      .join(", ");

    const answer = priceLines
      ? `${found.name} อยู่ ${tier.name || "Tier " + found.tierId} ราคาแก๊ส ${priceLines}`
      : `${found.name} อยู่ ${tier.name || "Tier " + found.tierId} ยังไม่ได้ตั้งราคาครับ`;

    return res.status(200).json({ answer });

  } catch (err) {
    return res.status(500).json({ answer: "เกิดข้อผิดพลาด กรุณาลองใหม่ครับ" });
  }
}
