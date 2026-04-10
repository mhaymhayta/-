import { useState, useMemo, useEffect } from "react";

const BRANDS = ["ยูนิค", "ปตท", "ออร์คิด", "เวิลด์", "PT", "ถามยี่ห้อ"];
const SIZES = [4, 7, 8, 11.5, 15, 48];
const BRAND_COLOR = {
  "ยูนิค":"#e67e22","ปตท":"#2980b9","ออร์คิด":"#8e44ad","เวิลด์":"#27ae60","PT":"#c0392b","ถามยี่ห้อ":"#95a5a6"
};

const initTiers = [
  { id:"A", name:"A · หน้าร้าน/ร้านอาหารรุ่นใหม่", color:"#1b4332", prices:{ 4:0, 7:0, 8:0, 11.5:0, 15:0, 48:0 } },
  { id:"B", name:"B · ลูกค้าประจำ",                color:"#2980b9", prices:{ 4:0, 7:0, 8:0, 11.5:0, 15:0, 48:0 } },
  { id:"C", name:"C · ลูกค้าบ้าน",                 color:"#e67e22", prices:{ 4:0, 7:0, 8:0, 11.5:0, 15:0, 48:0 } },
  { id:"E", name:"E · ลูกค้าพิเศษ",                color:"#c0392b", prices:{ 4:0, 7:0, 8:0, 11.5:0, 15:0, 48:0 } },
  { id:"F", name:"F · ลูกค้าหมายเหตุ",             color:"#7f8c8d", prices:{ 4:0, 7:0, 8:0, 11.5:0, 15:0, 48:0 } },
];

// API URL — ใส่ URL ที่ได้จาก Apps Script Deploy ตรงนี้
const API_URL = "/api/proxy";

async function apiFetch(params) {
  const url = API_URL + "?" + new URLSearchParams(params);
  const res = await fetch(url);
  const json = await res.json();
  if (!json.ok) throw new Error(json.error);
  return json.data;
}

async function apiPost(body) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error);
  return json.data;
}



function thaiToday() {
  const d = new Date();
  return String(d.getDate()).padStart(2,"0")+"/"+String(d.getMonth()+1).padStart(2,"0")+"/"+(d.getFullYear()+543);
}
function newCust(nextId) {
  return { id:nextId, name:"", type:"ขาประจำ", tierId:"A", phone:"", mapUrl:"", note:"", tanks:[{ brand:"ปตท", size:15 }] };
}

export default function GasApp() {
  const [tab, setTab]               = useState("customers");
  const [tiers, setTiers]           = useState([]);
  const [customers, setCustomers]   = useState([]);
  const [search, setSearch]         = useState("");
  const [filterType, setFilterType] = useState("ทั้งหมด");
  const [filterTier, setFilterTier] = useState("ทั้งหมด");
  const [expandedId, setExpandedId] = useState(null);
  const [showForm, setShowForm]     = useState(false);
  const [editId, setEditId]         = useState(null);
  const [form, setForm]             = useState(newCust(9999));
  const [showTierMgr, setShowTierMgr] = useState(false);
  const [editTiers, setEditTiers]   = useState(null);
  const [priceLog, setPriceLog]     = useState([{ date:thaiToday(), note:"นำเข้าข้อมูลจาก Excel (พย66)" }]);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [apiReady, setApiReady]     = useState(true);

  // โหลดข้อมูลจาก Sheets
  function loadData(isFirst) {
    if (!apiReady) { if (isFirst) setLoading(false); return; }
    apiFetch({ action: "all" })
      .then(data => {
        if (data.tiers && data.tiers.length > 0) {
          // แปลง prices key จาก string เป็น number
          const fixedTiers = data.tiers.map(t => ({
            ...t,
            prices: Object.fromEntries(
              Object.entries(t.prices || {}).map(([k,v]) => [parseFloat(k), Number(v)])
            )
          }));
          setTiers(fixedTiers);
        }
        if (data.customers) setCustomers(data.customers);
        if (isFirst) setPriceLog(l => [...l, { date:thaiToday(), note:"โหลดข้อมูลจาก Google Sheets" }]);
      })
      .catch(e => console.error("Load error:", e))
      .finally(() => { if (isFirst) setLoading(false); });
  }

  // โหลดครั้งแรก + auto-refresh ทุก 30 วินาที เฉพาะตอนไม่ได้พิมพ์
  useEffect(() => {
    loadData(true);
    const interval = setInterval(() => {
      if (!search) loadData(false);
    }, 30 * 1000);
    return () => clearInterval(interval);
  }, [search]);

  // บันทึกลูกค้าลง Sheets
  async function syncCustomers(newCustomers) {
    if (!apiReady) return;
    setSaving(true);
    try { await apiPost({ action:"saveCustomers", data:newCustomers }); }
    catch(e) { console.error("Sync error:", e); }
    finally { setSaving(false); }
  }

  // บันทึก Tier ลง Sheets
  async function syncTiers(newTiers) {
    if (!apiReady) return;
    setSaving(true);
    try { await apiPost({ action:"saveTiers", data:newTiers }); }
    catch(e) { console.error("Sync error:", e); }
    finally { setSaving(false); }
  }

  const nextId = () => Math.max(...customers.map(c=>c.id), 0) + 1;
  const getTier  = (id) => tiers.find(t => t.id===id) || tiers[0];
  const tkPrice  = (tierId, size) => getTier(tierId).prices[size] || 0;

  const filtered = useMemo(() => customers.filter(c =>
    (c.name.includes(search) || (c.phone||"").includes(search) || (c.note||"").includes(search)) &&
    (filterType==="ทั้งหมด" || c.type===filterType) &&
    (filterTier==="ทั้งหมด" || c.tierId===filterTier)
  ), [customers, search, filterType, filterTier]);

  function openAdd()   { setForm(newCust(nextId())); setEditId(null); setShowForm(true); }
  function openEdit(c) { setForm({...c, tanks:c.tanks.map(t=>({...t}))}); setEditId(c.id); setShowForm(true); }
  function saveForm()  {
    if (!form.name.trim()) return;
    let updated;
    if (editId) updated = customers.map(c => c.id===editId ? form : c);
    else        updated = [...customers, {...form, id:nextId()}];
    setCustomers(updated);
    syncCustomers(updated);
    setShowForm(false);
  }
  function delCust(id) {
    if(confirm("ลบลูกค้ารายนี้?")) {
      const updated = customers.filter(c => c.id!==id);
      setCustomers(updated);
      syncCustomers(updated);
    }
  }
  function addTank()   { setForm(f => ({...f, tanks:[...f.tanks, {brand:"ปตท", size:15}]})); }
  function removeTank(i) { setForm(f => ({...f, tanks:f.tanks.filter((_,idx)=>idx!==i)})); }
  function setTankField(i, field, val) {
    setForm(f => ({...f, tanks:f.tanks.map((t,idx) => idx===i ? {...t,[field]:field==="size"?Number(val):val} : t)}));
  }
  function openTierMgr() { setEditTiers(tiers.map(t=>({...t,prices:{...t.prices}}))); setShowTierMgr(true); }
  function saveTiers()   {
    setTiers(editTiers);
    syncTiers(editTiers);
    setPriceLog(l => [...l, {date:thaiToday(), note:"อัพเดต Tier ราคา"}]);
    setShowTierMgr(false);
  }
  function addTierRow() {
    const used = editTiers.map(t => t.id);
    const newId = "ABCDEFGHIJ".split("").find(x => !used.includes(x)) || String(Date.now());
    setEditTiers(ts => [...ts, {id:newId, name:"Tier ใหม่", color:"#7f8c8d", prices:{4:0,7:0,8:0,11.5:0,15:0,48:0}}]);
  }
  function removeTierRow(i) { setEditTiers(ts => ts.filter((_,idx) => idx!==i)); }
  function adjustTier(ti, delta) {
    setEditTiers(ts => ts.map((t,i) => i!==ti ? t : {
      ...t, prices: Object.fromEntries(SIZES.map(s => [s, (t.prices[s]||0)+delta]))
    }));
  }

  const card   = { background:"white", borderRadius:12, boxShadow:"0 2px 10px rgba(0,0,0,0.07)" };
  const btnRed = { padding:"8px 16px", borderRadius:8, border:"none", cursor:"pointer", background:"#e94560", color:"white", fontFamily:"inherit", fontSize:13, fontWeight:700 };
  const inp    = { padding:"8px 12px", borderRadius:8, border:"1px solid #dde", fontFamily:"inherit", fontSize:14, boxSizing:"border-box", width:"100%" };

  return (
    <div style={{fontFamily:"'Sarabun',sans-serif", minHeight:"100vh", background:"#eef1f7"}}>
      <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap" rel="stylesheet"/>

      {/* API not configured warning */}
      {!apiReady && (
        <div style={{background:"#e94560", color:"white", padding:"8px 16px", fontSize:13, textAlign:"center", fontWeight:600}}>
          ⚠️ ยังไม่ได้ตั้งค่า API URL — ข้อมูลจะไม่ถูกบันทึกลง Google Sheets
        </div>
      )}

      {/* Saving indicator */}
      {saving && (
        <div style={{background:"#52b788", color:"white", padding:"6px 16px", fontSize:12, textAlign:"center"}}>
          💾 กำลังบันทึกลง Google Sheets...
        </div>
      )}

      {/* Loading screen */}
      {loading && (
        <div style={{position:"fixed", inset:0, background:"rgba(255,255,255,0.92)", zIndex:999, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:12}}>
          <div style={{fontSize:40}}>🔥</div>
          <div style={{fontWeight:700, fontSize:18, color:"#1b4332"}}>กำลังโหลดข้อมูล...</div>
          <div style={{fontSize:13, color:"#aaa"}}>ดึงข้อมูลจาก Google Sheets</div>
        </div>
      )}

      <div style={{background:"linear-gradient(135deg,#0d1b2a,#1b4332)", padding:"16px 20px", color:"white"}}>
        <div style={{display:"flex", alignItems:"center", gap:12}}>
          <span style={{fontSize:30}}>🔥</span>
          <div>
            <div style={{fontWeight:700, fontSize:19}}>ระบบจัดการลูกค้าแก๊ส</div>
            <div style={{fontSize:12, opacity:.65}}>{thaiToday()} • ลูกค้า {customers.length} ราย</div>
          </div>
        </div>
        <div style={{display:"flex", gap:8, marginTop:14, flexWrap:"wrap"}}>
          {[["customers","👥 ลูกค้า"],["tiers","🏷️ Tier ราคา"],["summary","📊 สรุป"]].map(([k,l])=>(
            <button key={k} onClick={()=>setTab(k)} style={{
              padding:"6px 16px", borderRadius:20, border:"none", cursor:"pointer",
              fontFamily:"inherit", fontSize:13, fontWeight:600,
              background:tab===k?"#52b788":"rgba(255,255,255,0.18)", color:"white"
            }}>{l}</button>
          ))}
        </div>
      </div>

      <div style={{padding:16, maxWidth:860, margin:"0 auto"}}>

        {tab==="customers" && <>
          <div style={{display:"flex", gap:8, marginBottom:10, flexWrap:"wrap"}}>
            <input placeholder="🔍 ค้นหาชื่อร้าน / เบอร์ / หมายเหตุ..." value={search} onChange={e=>setSearch(e.target.value)}
              style={{...inp, flex:1, minWidth:180}}/>
            <button onClick={openAdd} style={btnRed}>+ เพิ่มลูกค้า</button>
          </div>
          <div style={{display:"flex", gap:6, marginBottom:12, flexWrap:"wrap"}}>
            {["ทั้งหมด",...tiers.map(t=>t.id)].map(t=>(
              <button key={t} onClick={()=>setFilterTier(t)} style={{
                padding:"6px 12px", borderRadius:8, border:"none", cursor:"pointer",
                fontFamily:"inherit", fontSize:12, fontWeight:600,
                background:filterTier===t?(t==="ทั้งหมด"?"#555":getTier(t).color):"#e0e7ee",
                color:filterTier===t?"white":"#333"
              }}>{t==="ทั้งหมด"?"ทุก Tier":getTier(t).name}</button>
            ))}
            <span style={{fontSize:12, color:"#aaa", alignSelf:"center"}}>({filtered.length} ราย)</span>
          </div>

          {filtered.length===0 && <div style={{textAlign:"center", padding:40, color:"#aaa"}}>ไม่พบลูกค้า</div>}

          {filtered.map(c => {
            const tier = getTier(c.tierId);
            const open = expandedId===c.id;
            return (
              <div key={c.id} style={{...card, marginBottom:8, borderLeft:"4px solid "+tier.color, overflow:"hidden"}}>
                <div style={{padding:"11px 14px", cursor:"pointer"}} onClick={()=>setExpandedId(open?null:c.id)}>
                  <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start"}}>
                    <div style={{flex:1, minWidth:0}}>
                      <div style={{display:"flex", alignItems:"center", gap:7, flexWrap:"wrap"}}>
                        <span style={{fontWeight:700, fontSize:15}}>{c.name}</span>
                        <span style={{padding:"2px 8px", borderRadius:20, fontSize:11, fontWeight:700,
                          background:tier.color+"22", color:tier.color, border:"1px solid "+tier.color+"55", whiteSpace:"nowrap"}}>
                          {tier.name}
                        </span>
                      </div>
                      {(c.phone||c.note) && (
                        <div style={{fontSize:12, color:"#888", marginTop:3}}>
                          {c.phone && <span>📞 {c.phone}</span>}
                          {c.phone && c.note && <span> · </span>}
                          {c.note && <span style={{color:"#e67e22"}}>📝 {c.note}</span>}
                        </div>
                      )}
                    </div>
                    <div style={{fontSize:11, color:"#ccc", marginLeft:8, paddingTop:3, flexShrink:0}}>{open?"▲":"▼"}</div>
                  </div>
                  <div style={{display:"flex", flexWrap:"wrap", gap:4, marginTop:7}}>
                    {c.tanks.map((tk,i) => {
                      const col = BRAND_COLOR[tk.brand] || "#999";
                      const p = tkPrice(c.tierId, tk.size);
                      return (
                        <span key={i} style={{padding:"3px 9px", borderRadius:6, fontSize:12, fontWeight:700,
                          background:col+"15", color:col, border:"1px solid "+col+"44"}}>
                          {tk.brand} {tk.size}กก {p>0?"→ "+p.toLocaleString()+" ฿":""}
                        </span>
                      );
                    })}
                  </div>
                </div>

                {open && (
                  <div style={{borderTop:"1px solid #eef", padding:"12px 14px", background:"#f7faf9"}}>
                    <div style={{display:"flex", gap:6, flexWrap:"wrap", marginBottom:10}}>
                      {c.tanks.map((tk,i) => {
                        const col = BRAND_COLOR[tk.brand]||"#999";
                        const p = tkPrice(c.tierId, tk.size);
                        return (
                          <div key={i} style={{background:"white", borderRadius:9, padding:"7px 12px", border:"1.5px solid "+col+"33"}}>
                            <div style={{fontSize:12, color:col, fontWeight:700}}>{tk.brand} {tk.size} กก</div>
                            <div style={{fontWeight:700, fontSize:17, color:"#0d1b2a", marginTop:1}}>
                              {p>0 ? p.toLocaleString()+" ฿" : <span style={{color:"#ccc"}}>ยังไม่ตั้ง</span>}
                            </div>
                            <div style={{fontSize:11, color:"#aaa"}}>ต่อใบ</div>
                          </div>
                        );
                      })}
                    </div>
                    {c.note && (
                      <div style={{background:"#fff8e1", borderRadius:8, padding:"6px 10px", marginBottom:10, fontSize:13, color:"#7d5a00", border:"1px solid #ffe082"}}>
                        📝 {c.note}
                      </div>
                    )}
                    <div style={{display:"flex", gap:7, flexWrap:"wrap"}}>
                      {c.mapUrl && <a href={c.mapUrl} target="_blank" rel="noopener noreferrer"
                        style={{padding:"6px 12px", borderRadius:8, background:"#2980b9", color:"white", fontSize:12, fontWeight:700, textDecoration:"none"}}>📍 แผนที่</a>}
                      <button onClick={()=>openEdit(c)} style={{padding:"6px 12px", borderRadius:8, border:"none", background:"#fdf2e9", color:"#d35400", cursor:"pointer", fontFamily:"inherit", fontSize:12, fontWeight:700}}>✏️ แก้ไข</button>
                      <button onClick={()=>delCust(c.id)} style={{padding:"6px 12px", borderRadius:8, border:"none", background:"#fdedec", color:"#c0392b", cursor:"pointer", fontFamily:"inherit", fontSize:12, fontWeight:700}}>🗑️ ลบ</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {showForm && (
            <div style={{position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:16}}>
              <div style={{background:"white", borderRadius:16, padding:22, width:"100%", maxWidth:500, maxHeight:"92vh", overflowY:"auto"}}>
                <div style={{fontWeight:700, fontSize:18, marginBottom:14}}>{editId?"แก้ไขลูกค้า":"เพิ่มลูกค้าใหม่"}</div>
                {[["name","ชื่อร้าน *"],["phone","เบอร์โทร"],["mapUrl","ลิงก์ Google Maps"]].map(([f,l])=>(
                  <div key={f} style={{marginBottom:10}}>
                    <div style={{fontSize:13, fontWeight:600, marginBottom:3, color:"#555"}}>{l}</div>
                    <input value={form[f]||""} onChange={e=>setForm(p=>({...p,[f]:e.target.value}))} style={inp}
                      placeholder={f==="mapUrl"?"https://maps.google.com/...":""}/>
                  </div>
                ))}
                <div style={{marginBottom:10}}>
                  <div style={{fontSize:13, fontWeight:600, marginBottom:3, color:"#555"}}>หมายเหตุ / ข้อสังเกต</div>
                  <textarea value={form.note||""} onChange={e=>setForm(f=>({...f,note:e.target.value}))} rows={2}
                    placeholder="เช่น โอนส่งสลิป / ถ่ายบิลส่งไลน์ / หมุนถัง..."
                    style={{...inp, resize:"vertical"}}/>
                </div>
                <div style={{marginBottom:10}}>
                  <div style={{fontSize:13, fontWeight:600, marginBottom:4, color:"#555"}}>ประเภท</div>
                  <div style={{display:"flex", gap:8}}>
                    {["ขาประจำ","ขาจร"].map(t=>(
                      <button key={t} onClick={()=>setForm(f=>({...f,type:t}))} style={{
                        padding:"7px 18px", borderRadius:8, border:"none", cursor:"pointer",
                        fontFamily:"inherit", fontSize:13, fontWeight:600,
                        background:form.type===t?"#1b4332":"#e0e7ee", color:form.type===t?"white":"#333"
                      }}>{t}</button>
                    ))}
                  </div>
                </div>
                <div style={{marginBottom:14, background:"#f0f9f4", borderRadius:10, padding:12, border:"1px solid #b7e4c7"}}>
                  <div style={{fontWeight:700, fontSize:13, color:"#1b4332", marginBottom:8}}>🏷️ เลือก Tier ราคา</div>
                  <div style={{display:"flex", gap:7, flexWrap:"wrap"}}>
                    {tiers.map(tier=>(
                      <button key={tier.id} onClick={()=>setForm(f=>({...f,tierId:tier.id}))} style={{
                        padding:"7px 13px", borderRadius:10,
                        border:"2px solid "+(form.tierId===tier.id?tier.color:"#dde"),
                        background:form.tierId===tier.id?tier.color+"18":"white",
                        cursor:"pointer", fontFamily:"inherit", fontSize:13, fontWeight:700, color:tier.color
                      }}>
                        <div>{tier.name}</div>
                        <div style={{fontSize:11, color:"#999", marginTop:1}}>15กก={tier.prices[15]>0?tier.prices[15].toLocaleString()+"฿":"—"}</div>
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{marginBottom:12}}>
                  <div style={{fontWeight:700, fontSize:13, color:"#555", marginBottom:4}}>🛢️ ถังแก๊ส</div>
                  {form.tanks.map((tk,i) => {
                    const p = (tiers.find(t=>t.id===form.tierId)||tiers[0]).prices[tk.size]||0;
                    return (
                      <div key={i} style={{display:"flex", gap:5, marginBottom:5, alignItems:"center", background:"#fafafa", borderRadius:8, padding:"6px 8px"}}>
                        <select value={tk.brand} onChange={e=>setTankField(i,"brand",e.target.value)}
                          style={{flex:2, padding:"6px", borderRadius:7, border:"1px solid #dde", fontFamily:"inherit", fontSize:13}}>
                          {BRANDS.map(b=><option key={b}>{b}</option>)}
                        </select>
                        <select value={tk.size} onChange={e=>setTankField(i,"size",e.target.value)}
                          style={{flex:1.5, padding:"6px", borderRadius:7, border:"1px solid #dde", fontFamily:"inherit", fontSize:13}}>
                          {SIZES.map(s=><option key={s} value={s}>{s} กก</option>)}
                        </select>
                        <span style={{fontSize:12, color:"#52b788", fontWeight:700, minWidth:65}}>{p>0?p.toLocaleString()+" ฿":"—"}</span>
                        <button onClick={()=>removeTank(i)} style={{background:"none", border:"none", color:"#c0392b", cursor:"pointer", fontSize:20, padding:"0 2px"}}>×</button>
                      </div>
                    );
                  })}
                  <button onClick={addTank} style={{padding:"5px 12px", borderRadius:8, border:"1px dashed #1b4332", background:"none", color:"#1b4332", cursor:"pointer", fontFamily:"inherit", fontSize:13, fontWeight:600}}>+ เพิ่มถัง</button>
                </div>
                <div style={{display:"flex", gap:8}}>
                  <button onClick={saveForm} style={{flex:1, padding:10, borderRadius:8, border:"none", background:"#e94560", color:"white", fontFamily:"inherit", fontSize:14, fontWeight:700, cursor:"pointer"}}>
                    {editId?"บันทึก":"เพิ่มลูกค้า"}
                  </button>
                  <button onClick={()=>setShowForm(false)} style={{padding:"10px 18px", borderRadius:8, border:"1px solid #dde", background:"white", fontFamily:"inherit", fontSize:14, cursor:"pointer"}}>ยกเลิก</button>
                </div>
              </div>
            </div>
          )}
        </>}

        {tab==="tiers" && <>
          <div style={{background:"#e8f5e9", borderRadius:10, padding:"10px 14px", marginBottom:14, fontSize:13, color:"#1b5e20", border:"1px solid #a5d6a7"}}>
            💡 แก้ราคาที่ Tier เดียว → ทุกร้านที่ใช้ Tier นั้นปรับตามทันที
          </div>
          <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12}}>
            <div style={{fontWeight:700, fontSize:16}}>Tier ราคาแก๊ส (5 Tier)</div>
            <button onClick={openTierMgr} style={btnRed}>✏️ ใส่ / แก้ไขราคา</button>
          </div>
          <div style={{...card, overflow:"hidden", marginBottom:16}}>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%", borderCollapse:"collapse", fontSize:14}}>
                <thead>
                  <tr style={{background:"#0d1b2a", color:"white"}}>
                    <th style={{padding:"10px 14px", textAlign:"left"}}>Tier</th>
                    {SIZES.map(s=><th key={s} style={{padding:"10px 12px", textAlign:"center"}}>{s} กก</th>)}
                    <th style={{padding:"10px 12px", textAlign:"center"}}>จำนวนร้าน</th>
                  </tr>
                </thead>
                <tbody>
                  {tiers.map((tier,ti)=>{
                    const cnt = customers.filter(c=>c.tierId===tier.id).length;
                    return (
                      <tr key={tier.id} style={{borderBottom:"1px solid #f0f0f0", background:ti%2===0?"white":"#fafafa"}}>
                        <td style={{padding:"11px 14px", fontWeight:700, color:tier.color, fontSize:15}}>{tier.name}</td>
                        {SIZES.map(s=>(
                          <td key={s} style={{padding:"11px 12px", textAlign:"center", fontWeight:700, color:tier.prices[s]>0?"#0d1b2a":"#ddd"}}>
                            {tier.prices[s]>0?tier.prices[s].toLocaleString():"—"}
                          </td>
                        ))}
                        <td style={{padding:"11px 12px", textAlign:"center", fontWeight:700, color:"#555"}}>{cnt}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <div style={{...card, padding:16}}>
            <div style={{fontWeight:700, fontSize:14, marginBottom:10}}>📋 ประวัติการเปลี่ยนราคา</div>
            {priceLog.map((h,i)=>(
              <div key={i} style={{display:"flex", gap:12, padding:"6px 0", borderBottom:i<priceLog.length-1?"1px solid #f0f0f0":"none"}}>
                <span style={{fontSize:13, color:"#aaa", minWidth:90}}>{h.date}</span>
                <span style={{fontSize:13, color:"#555"}}>{h.note}</span>
              </div>
            ))}
          </div>

          {showTierMgr && editTiers && (
            <div style={{position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:16}}>
              <div style={{background:"white", borderRadius:16, padding:22, width:"100%", maxWidth:580, maxHeight:"92vh", overflowY:"auto"}}>
                <div style={{fontWeight:700, fontSize:18, marginBottom:4}}>ใส่ / แก้ไขราคา Tier</div>
                <div style={{fontSize:13, color:"#e94560", marginBottom:16}}>⚠️ ราคาที่แก้จะกระทบทุกร้านที่ใช้ Tier นั้นทันที</div>
                {editTiers.map((tier,ti)=>(
                  <div key={tier.id} style={{marginBottom:16, background:"#f7f9f7", borderRadius:12, padding:14, border:"1.5px solid "+tier.color+"44"}}>
                    <div style={{display:"flex", alignItems:"center", gap:8, marginBottom:10, flexWrap:"wrap"}}>
                      <input type="color" value={tier.color}
                        onChange={e=>setEditTiers(ts=>ts.map((t,i)=>i===ti?{...t,color:e.target.value}:t))}
                        style={{width:32, height:32, borderRadius:6, border:"none", cursor:"pointer", padding:2}}/>
                      <input value={tier.name}
                        onChange={e=>setEditTiers(ts=>ts.map((t,i)=>i===ti?{...t,name:e.target.value}:t))}
                        style={{flex:1, padding:"6px 10px", borderRadius:8, border:"1px solid #dde", fontFamily:"inherit", fontSize:14, fontWeight:700}}/>
                      <span style={{fontSize:12, color:"#aaa"}}>{customers.filter(c=>c.tierId===tier.id).length} ร้าน</span>
                    </div>
                    <div style={{display:"flex", gap:8, flexWrap:"wrap", marginBottom:8}}>
                      {SIZES.map(s=>(
                        <div key={s} style={{textAlign:"center"}}>
                          <div style={{fontSize:11, color:"#aaa", marginBottom:3}}>{s} กก</div>
                          <input type="number" value={tier.prices[s]||""} placeholder="0"
                            onChange={e=>setEditTiers(ts=>ts.map((t,i)=>i===ti?{...t,prices:{...t.prices,[s]:Number(e.target.value)}}:t))}
                            style={{width:76, padding:"7px 6px", borderRadius:8, border:"2px solid "+(tier.prices[s]>0?tier.color:"#dde"), fontFamily:"inherit", fontSize:14, textAlign:"center", fontWeight:700}}/>
                        </div>
                      ))}
                    </div>
                    <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6}}>
                      {editTiers.length > 1 && (
                        <button onClick={()=>removeTierRow(editTiers.indexOf(tier))} style={{padding:"4px 10px", borderRadius:6, border:"none", background:"#fdedec", color:"#c0392b", cursor:"pointer", fontFamily:"inherit", fontSize:12, fontWeight:700}}>ลบ Tier นี้</button>
                      )}
                    </div>
                    <div style={{display:"flex", gap:5, alignItems:"center", flexWrap:"wrap"}}>
                      <span style={{fontSize:12, color:"#888", fontWeight:600}}>ปรับทั้ง Tier:</span>
                      {[-20,-10,-5,+5,+10,+20].map(d=>(
                        <button key={d} onClick={()=>adjustTier(ti,d)} style={{
                          padding:"4px 9px", borderRadius:6, border:"1px solid #dde",
                          background:d>0?"#fff0f0":"#f0fff4", color:d>0?"#c0392b":"#1e8449",
                          cursor:"pointer", fontFamily:"inherit", fontSize:12, fontWeight:700
                        }}>{d>0?"+"+d:d}</button>
                      ))}
                    </div>
                  </div>
                ))}
                <button onClick={addTierRow} style={{padding:"7px 16px", borderRadius:8, border:"1px dashed #1b4332", background:"none", color:"#1b4332", cursor:"pointer", fontFamily:"inherit", fontSize:13, fontWeight:700, marginBottom:12}}>+ เพิ่ม Tier ใหม่</button>
                <div style={{display:"flex", gap:8}}>
                  <button onClick={saveTiers} style={{flex:1, padding:10, borderRadius:8, border:"none", background:"#e94560", color:"white", fontFamily:"inherit", fontSize:14, fontWeight:700, cursor:"pointer"}}>บันทึก</button>
                  <button onClick={()=>setShowTierMgr(false)} style={{padding:"10px 18px", borderRadius:8, border:"1px solid #dde", background:"white", fontFamily:"inherit", fontSize:14, cursor:"pointer"}}>ยกเลิก</button>
                </div>
              </div>
            </div>
          )}
        </>}

        {tab==="summary" && <>
          <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14}}>
            {[
              ["👥","ลูกค้าทั้งหมด",customers.length+" ราย","#e8f4fd"],
              ["⭐","ขาประจำ",customers.filter(c=>c.type==="ขาประจำ").length+" ราย","#d5f5e3"],
              ["🌟","ขาจร",customers.filter(c=>c.type==="ขาจร").length+" ราย","#fef9e7"],
              ["📝","มีหมายเหตุ",customers.filter(c=>c.note).length+" ราย","#fff8e1"],
            ].map(([icon,label,val,bg])=>(
              <div key={label} style={{background:bg, borderRadius:12, padding:"14px 16px", boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}>
                <div style={{fontSize:22}}>{icon}</div>
                <div style={{fontSize:12, color:"#666", marginTop:4}}>{label}</div>
                <div style={{fontWeight:700, fontSize:18, color:"#0d1b2a"}}>{val}</div>
              </div>
            ))}
          </div>
          <div style={{...card, padding:16, marginBottom:12}}>
            <div style={{fontWeight:700, fontSize:14, marginBottom:12}}>แยกตาม Tier</div>
            {tiers.map(tier=>{
              const cnt = customers.filter(c=>c.tierId===tier.id).length;
              return (
                <div key={tier.id} style={{display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:"1px solid #f5f5f5"}}>
                  <div style={{display:"flex", alignItems:"center", gap:10}}>
                    <span style={{display:"inline-block", width:12, height:12, borderRadius:"50%", background:tier.color}}></span>
                    <span style={{fontWeight:700, color:tier.color}}>{tier.name}</span>
                  </div>
                  <div style={{display:"flex", alignItems:"center", gap:16}}>
                    <span style={{fontSize:13, color:"#aaa"}}>{cnt} ร้าน</span>
                    <span style={{fontWeight:700, color:"#0d1b2a"}}>15กก = {tier.prices[15]>0?tier.prices[15].toLocaleString()+" ฿":"ยังไม่ตั้ง"}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{...card, padding:16}}>
            <div style={{fontWeight:700, fontSize:14, marginBottom:10}}>📝 ลูกค้าที่มีหมายเหตุ</div>
            {customers.filter(c=>c.note).map(c=>{
              const tier = getTier(c.tierId);
              return (
                <div key={c.id} style={{padding:"8px 0", borderBottom:"1px solid #f5f5f5"}}>
                  <div style={{display:"flex", alignItems:"center", gap:7, flexWrap:"wrap"}}>
                    <span style={{fontWeight:700, fontSize:14}}>{c.name}</span>
                    <span style={{fontSize:11, padding:"2px 7px", borderRadius:8, fontWeight:700, background:tier.color+"22", color:tier.color}}>{tier.name}</span>
                  </div>
                  <div style={{fontSize:12, color:"#e67e22", marginTop:3}}>📝 {c.note}</div>
                </div>
              );
            })}
          </div>
        </>}
      </div>
    </div>
  );
}
