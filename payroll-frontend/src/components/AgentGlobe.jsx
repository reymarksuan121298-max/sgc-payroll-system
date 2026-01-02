import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from 'react-leaflet';
import { supabase } from '../lib/supabase';
import { QRCodeSVG } from 'qrcode.react'; 
import imageCompression from 'browser-image-compression'; 
import L from 'leaflet';
import { renderToString } from 'react-dom/server';
import { motion, AnimatePresence } from 'framer-motion'; 
import { Store, User, Camera, CheckCircle2, X, AlertTriangle, Search, Database, Zap, MapPin, Activity, Filter, Download, FileSpreadsheet } from 'lucide-react';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import 'leaflet/dist/leaflet.css';

const getDist = (lat1, lon1, lat2, lon2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R = 6371e3, dLat = (lat2 - lat1) * Math.PI / 180, dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
};

const PH_B = [[4.2, 114.0], [21.5, 127.0]], PH_C = [12.8797, 121.7740];

const createIcon = (Comp, color, isAgent = false) => new L.DivIcon({
  html: renderToString(
    <div className="relative flex items-center justify-center">
      {isAgent ? (
        <><div className="absolute w-8 h-8 bg-cyan-500/30 rounded-full animate-ping"/><div className="p-1.5 rounded-full border-2 border-white shadow-lg bg-cyan-600"><Comp size={16} color="white" strokeWidth={2.5}/></div></>
      ) : (<div className="drop-shadow-[0_2px_5px_rgba(0,0,0,0.7)] hover:scale-110 transition-transform"><Comp size={32} color={color} fill="#facc15" strokeWidth={2.5}/></div>)}
    </div>
  ),
  className: 'custom-lucide-icon', iconSize: isAgent ? [30, 30] : [35, 35], iconAnchor: isAgent ? [15, 15] : [17, 17], popupAnchor: [0, -15]
});

const MapCtrl = ({ target }) => {
  const map = useMap();
  useEffect(() => {
    if (target?.coords) {
      map.flyTo([target.coords.lat, target.coords.lng], 18, { animate: true, duration: 1.5 });
      setTimeout(() => target.markerRef?.current?.openPopup(), 1600);
    }
  }, [target, map]);
  return null;
};

export default function UpdatedAgentGlobe() {
  const [data, setData] = useState({ logs: [], kiosks: [], areas: [] });
  const [ui, setUi] = useState({ view: 'logs', drawer: false, modal: false, confirm: false, loading: false, isFlipped: false });
  const [search, setSearch] = useState("");
  const [kiosk, setKiosk] = useState({ code: "", areaId: "", lat: "", lng: "", fullKioskCode: "" });
  const [area, setArea] = useState({ name: "", abbr: "" });
  const [file, setFile] = useState(null), [target, setTarget] = useState(null), [selId, setSelId] = useState(null);
  const mRefs = useRef({});

  const fetchAll = useCallback(async () => {
    const [l, k, a] = await Promise.all([
      supabase.from('agent_logs').select('*').order('created_at', { ascending: false }),
      supabase.from('kiosks').select('*').order('kiosk_code', { ascending: true }),
      supabase.from('area_clusters').select('*').order('name', { ascending: true })
    ]);
    setData({ logs: l.data || [], kiosks: k.data || [], areas: a.data || [] });
  }, []);

  useEffect(() => { fetchAll(); const i = setInterval(() => !target && fetchAll(), 15e3); return () => clearInterval(i); }, [fetchAll, target]);

  const resetKioskForm = useCallback(() => {
    setKiosk({ code: "", areaId: "", lat: "", lng: "", fullKioskCode: "" });
    setFile(null);
  }, []);

  useEffect(() => { if (!ui.drawer) resetKioskForm(); }, [ui.drawer, resetKioskForm]);

  // DERIVED DATA FOR COUNTS & TABLE
  const loggedKioskCodes = useMemo(() => new Set(data.logs.map(l => l.kiosk_code)), [data.logs]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    
    if (ui.view === 'logs') {
      let base = [...data.logs];
      if (ui.isFlipped) {
        base = base.filter(l => {
          const k = data.kiosks.find(n => n.kiosk_code === l.kiosk_code);
          return getDist(l.latitude, l.longitude, k?.latitude, k?.longitude) > 10;
        });
      }
      return base.filter(l => l.agent_name?.toLowerCase().includes(q) || l.kiosk_code?.toLowerCase().includes(q));
    } else {
      let base = [...data.kiosks];
      if (ui.isFlipped) {
        base = base.filter(k => !loggedKioskCodes.has(k.kiosk_code));
      } else {
        base = base.filter(k => loggedKioskCodes.has(k.kiosk_code));
      }
      return base.filter(k => k.kiosk_code?.toLowerCase().includes(q));
    }
  }, [search, data, ui.view, ui.isFlipped, loggedKioskCodes]);

  const line = useMemo(() => {
    const log = data.logs.find(l => l.id === selId);
    if (!selId || ui.view !== 'logs' || !log?.latitude) return null;
    const k = data.kiosks.find(nk => nk.kiosk_code === log.kiosk_code);
    return k ? { positions: [[+log.latitude, +log.longitude], [+k.latitude, +k.longitude]] } : null;
  }, [selId, data, ui.view]);

  const downloadExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const dateStr = new Date().toISOString().split('T')[0];

    const sheet1 = workbook.addWorksheet('Active Logs');
    sheet1.columns = [
      { header: 'Agent Name', key: 'name', width: 25 }, { header: 'Kiosk Code', key: 'kiosk', width: 15 },
      { header: 'Date', key: 'date', width: 15 }, { header: 'Time', key: 'time', width: 15 }, { header: 'Distance (m)', key: 'dist', width: 15 }
    ];
    data.logs.forEach(l => {
        const k = data.kiosks.find(nk => nk.kiosk_code === l.kiosk_code);
        sheet1.addRow({ name: l.agent_name, kiosk: l.kiosk_code, date: l.check_in_date, time: l.check_in_time, dist: getDist(l.latitude, l.longitude, k?.latitude, k?.longitude) || 0 });
    });

    const sheet2 = workbook.addWorksheet('Far Distance Agents');
    sheet2.columns = [...sheet1.columns];
    data.logs.forEach(l => {
      const k = data.kiosks.find(nk => nk.kiosk_code === l.kiosk_code);
      const dist = getDist(l.latitude, l.longitude, k?.latitude, k?.longitude);
      if (dist > 10) sheet2.addRow({ name: l.agent_name, kiosk: l.kiosk_code, date: l.check_in_date, time: l.check_in_time, dist: dist });
    });

    const sheet3 = workbook.addWorksheet('Active Kiosks');
    sheet3.columns = [{ header: 'Kiosk Code', key: 'code', width: 15 }, { header: 'Latitude', key: 'lat', width: 15 }, { header: 'Longitude', key: 'lng', width: 15 }, { header: 'Area ID', key: 'area', width: 10 }];
    data.kiosks.filter(k => loggedKioskCodes.has(k.kiosk_code)).forEach(k => {
      sheet3.addRow({ code: k.kiosk_code, lat: k.latitude, lng: k.longitude, area: k.area_id });
    });

    const sheet4 = workbook.addWorksheet('Inactive Kiosks');
    sheet4.columns = [...sheet3.columns];
    data.kiosks.filter(k => !loggedKioskCodes.has(k.kiosk_code)).forEach(k => {
      sheet4.addRow({ code: k.kiosk_code, lat: k.latitude, lng: k.longitude, area: k.area_id });
    });

    workbook.eachSheet(sheet => {
      sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
    });

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `NeoKyoto_Full_Report_${dateStr}.xlsx`);
  };

  const handleDownloadQR = () => {
    const svg = document.getElementById("qr-gen");
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width; canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      const pngFile = canvas.toDataURL("image/png");
      const downloadLink = document.createElement("a");
      downloadLink.download = `QR-${kiosk.fullKioskCode}.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
    };
    img.src = "data:image/svg+xml;base64," + btoa(svgData);
  };

  const onAreaSel = (id) => {
    const a = data.areas.find(x => x.id.toString() === id);
    if (!a) return;
    const n = Math.max(0, ...data.kiosks.filter(k => k.area_id?.toString() === id).map(k => +k.kiosk_code.split('-')[1] || 0)) + 1;
    const c = n.toString().padStart(3, '0');
    setKiosk({ ...kiosk, areaId: id, code: c, fullKioskCode: `${a.abbr}-${c}` });
  };

  const handleCoordChange = (field, value) => {
    if (value === "" || /^-?\d*\.?\d*$/.test(value)) setKiosk(prev => ({ ...prev, [field]: value }));
  };

  const onDeploy = async () => {
    if (!kiosk.fullKioskCode || !kiosk.lat || !kiosk.lng) return alert("Incomplete");
    setUi(p => ({ ...p, loading: true, confirm: false }));
    try {
      let url = null;
      if (file) {
        const comp = await imageCompression(file, { maxSizeMB: 0.8, maxWidthOrHeight: 1280, useWebWorker: true });
        const name = `${kiosk.fullKioskCode}-${Date.now()}.jpg`;
        await supabase.storage.from('kiosk-photos').upload(name, comp);
        url = supabase.storage.from('kiosk-photos').getPublicUrl(name).data.publicUrl;
      }
      await supabase.from('kiosks').insert([{ kiosk_code: kiosk.fullKioskCode, latitude: +kiosk.lat, longitude: +kiosk.lng, area_id: +kiosk.areaId, image_url: url }]);
      resetKioskForm();
      setUi(p => ({ ...p, drawer: false })); fetchAll();
    } catch (e) { alert(e.message); } finally { setUi(p => ({ ...p, loading: false })); }
  };

  return (
    <div className="flex flex-col h-screen w-full bg-[#050a14] text-slate-200 font-sans overflow-hidden">
      {/* NAVBAR */}
      <nav className="h-16 px-8 flex items-center justify-between border-b border-white/5 bg-[#0a1120] z-50">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]">
            <Zap size={22} fill="#facc15" strokeWidth={3}/>
          </div>
          <div>
            <h1 className="text-lg font-black text-white uppercase italic tracking-widest leading-none">GEO TAGGING</h1>
            <p className="text-[9px] text-blue-400 font-mono uppercase font-bold mt-1 tracking-widest opacity-80 underline underline-offset-4">Centralized Attendance System</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={downloadExcel} className="px-5 py-2 bg-emerald-600/10 border border-emerald-500/50 rounded-xl text-[10px] font-black uppercase tracking-widest text-emerald-400 hover:bg-emerald-500 hover:text-white transition-all cursor-pointer flex items-center gap-2 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
                <FileSpreadsheet size={14}/> Export Excel
            </motion.button>
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setUi(p => ({ ...p, modal: true }))} className="px-5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-700 transition-all cursor-pointer flex items-center gap-2">
                <Database size={14}/> Clusters
            </motion.button>
        </div>
      </nav>

      <div className="flex flex-1 p-4 gap-4 overflow-hidden relative">
        {/* SIDEBAR */}
        <motion.aside initial={{ x: -100, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="w-125 bg-[#0a1120] border border-white/5 rounded-4xl p-6 flex flex-col gap-6 shadow-2xl overflow-hidden shrink-0">
          <div className="flex items-start justify-between">
            <div>
               <h2 className="text-xl font-black text-white uppercase tracking-tighter">{ui.view === 'logs' ? (ui.isFlipped ? 'Drifted Logs' : 'Attendance') : (ui.isFlipped ? 'Inactive Kiosks' : 'Active Kiosk')}</h2>
               <p className="text-[11px] text-slate-500 italic opacity-70 tracking-widest uppercase font-bold">{ui.isFlipped ? 'Anomaly Detected' : 'Field Scan'}</p>
            </div>
            <div className="flex gap-2">
              {['logs', 'kiosks'].map(v => {
                // LOGIC FOR THE COUNT BOXES
                let displayCount = 0;
                if (v === 'logs') {
                   if (ui.isFlipped && ui.view === 'logs') {
                      displayCount = data.logs.filter(l => {
                        const k = data.kiosks.find(n => n.kiosk_code === l.kiosk_code);
                        return getDist(l.latitude, l.longitude, k?.latitude, k?.longitude) > 10;
                      }).length;
                   } else {
                      displayCount = data.logs.length;
                   }
                } else {
                   // Kiosks Count logic based on flip
                   if (ui.isFlipped && ui.view === 'kiosks') {
                      displayCount = data.kiosks.filter(k => !loggedKioskCodes.has(k.kiosk_code)).length;
                   } else {
                      displayCount = data.kiosks.filter(k => loggedKioskCodes.has(k.kiosk_code)).length;
                   }
                }

                return (
                  <div key={v} className="perspective-1000"> 
                    <motion.button 
                      onDoubleClick={() => setUi(p => ({ ...p, view: v, isFlipped: v === ui.view ? !p.isFlipped : false }))}
                      onClick={() => setUi(p => ({ ...p, view: v, isFlipped: v === ui.view ? p.isFlipped : false }))}
                      animate={{ rotateY: ui.isFlipped && ui.view === v ? 180 : 0 }}
                      transition={{ type: "spring", stiffness: 260, damping: 20 }}
                      className={`w-20 p-2 rounded-xl border transition-all cursor-pointer relative preserve-3d ${ui.view === v ? (ui.isFlipped ? 'bg-red-500/10 border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.3)]' : 'bg-cyan-500/10 border-cyan-500/50 shadow-lg') : 'bg-slate-800/40 border-white/10 opacity-50'}`}
                    >
                      <div className="backface-hidden">
                        <div className={`text-xl font-black ${ui.view === v ? (v === 'logs' ? 'text-cyan-400' : 'text-blue-400') : 'text-slate-400'}`}>{displayCount}</div>
                        <div className="text-[8px] font-bold uppercase text-slate-500">{v}</div>
                      </div>
                      <div className="absolute inset-0 flex flex-col items-center justify-center backface-hidden rotate-y-180">
                        <Filter size={14} className="text-red-500 mb-1" /><div className="text-[8px] font-black text-red-500 uppercase">Alert</div>
                      </div>
                    </motion.button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="relative group">
            <Search className={`absolute left-4 top-1/2 -translate-y-1/2 ${ui.isFlipped ? 'text-red-500' : 'text-slate-500 group-focus-within:text-blue-400'}`} size={16}/>
            <input type="text" placeholder={ui.isFlipped ? "Filtering anomalies..." : `Search ${ui.view}...`} className={`w-full bg-[#050a14] border rounded-2xl py-4 pl-12 pr-4 text-xs text-white outline-none transition-all font-mono italic ${ui.isFlipped ? 'border-red-500/50' : 'border-white/10 focus:border-blue-500/50'}`} value={search} onChange={e => setSearch(e.target.value)}/>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <table className="w-full text-left border-separate border-spacing-y-2">
              <thead><tr className="text-[10px] uppercase text-slate-500 font-black tracking-widest">{ui.view === 'logs' ? <><th className="pl-3">Agent</th><th>Kiosk</th><th>Time</th><th className="pr-3 text-right">Drift</th></> : <><th className="pl-3">{ui.isFlipped ? 'Inactive Kiosk' : 'Active Kiosk'}</th><th>Coordinates</th><th className="pr-3 text-right">Status</th></>}</tr></thead>
              <tbody className="text-[11px]">
                <AnimatePresence mode='popLayout'>
                  {filtered.map((item, i) => {
                    const k = data.kiosks.find(n => n.kiosk_code === item.kiosk_code), dist = ui.view === 'logs' ? getDist(item.latitude, item.longitude, k?.latitude, k?.longitude) : 0, isFar = dist > 10;
                    return (
                      <motion.tr key={item.id || i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.2, delay: i * 0.03 }} onClick={() => { setSelId(item.id); setTarget({ coords: { lat: +item.latitude, lng: +item.longitude }, markerRef: { current: mRefs.current[item.id] } }); }} className={`transition-all cursor-pointer border-l-2 ${selId === item.id ? 'bg-cyan-500/20 border-cyan-500' : isFar && ui.view === 'logs' ? 'bg-red-500/15 border-red-600 hover:bg-red-500/25' : 'bg-white/5 border-transparent hover:bg-blue-600/10'}`}>
                        <td className={`py-4 pl-4 rounded-l-xl font-bold uppercase ${isFar && ui.view === 'logs' ? 'text-red-400' : 'text-cyan-400'}`}><div className="flex flex-col"><span className="truncate max-w-25">{item.agent_name || item.kiosk_code}</span><span className="text-[8px] opacity-40 font-mono italic">#{item.id}</span></div></td>
                        <td className="py-4 text-slate-400 font-mono italic">{ui.view === 'logs' ? item.kiosk_code : `${(+item.latitude).toFixed(3)}, ${(+item.longitude).toFixed(3)}`}</td>
                        <td className="py-4 text-slate-500 font-mono">{ui.view === 'logs' ? <div className="flex flex-col"><span>{item.check_in_time}</span><span className="text-[8px] opacity-40">{item.check_in_date}</span></div> : <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${ui.isFlipped ? 'bg-red-500/20 text-red-500' : 'bg-green-500/20 text-green-500'}`}>{ui.isFlipped ? 'Inactive' : 'Live'}</span>}</td>
                        <td className={`py-4 pr-4 rounded-r-xl text-right font-black font-mono italic ${isFar && ui.view === 'logs' ? 'text-red-500' : 'text-slate-400'}`}>{ui.view === 'logs' ? <div className="flex items-center justify-end gap-1">{isFar && <AlertTriangle size={10}/>}{dist > 1000 ? `${(dist/1000).toFixed(1)}km` : `${dist}m`}</div> : 'OK'}</td>
                      </motion.tr>
                    )
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </motion.aside>

        {/* MAP */}
        <div className="flex-1 bg-slate-900 border border-white/10 rounded-4xl overflow-hidden shadow-2xl relative">
          <MapContainer center={PH_C} zoom={6} minZoom={6} maxBounds={PH_B} className="h-full w-full">
            <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" /><TileLayer url="https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}" opacity={0.4} /><MapCtrl target={target} />
            {line && <><Polyline positions={line.positions} pathOptions={{ color: '#06b6d4', weight: 8, opacity: 0.2, lineCap: 'round' }} /><Polyline positions={line.positions} pathOptions={{ color: '#22d3ee', weight: 3, dashArray: '10, 15', className: 'grab-route-active' }} /></>}
            
            {data.logs.map(l => l.latitude && (
              <Marker key={`a-${l.id}`} position={[+l.latitude, +l.longitude]} icon={createIcon(User, '#06b6d4', true)} ref={el => (mRefs.current[l.id] = el)}>
                <Popup className="custom-popup">
                  <div className="p-3 min-w-45 bg-[#0a1120] text-slate-200 rounded-xl border border-white/10 shadow-2xl font-sans">
                    <div className="flex items-center gap-2 mb-2 border-b border-white/5 pb-2"><Activity size={14} className="text-cyan-400 animate-pulse"/><span className="font-black uppercase text-[10px] tracking-tighter">Telemetry Report</span></div>
                    <div className="grid grid-cols-2 gap-y-1.5 text-[9px] font-mono uppercase">
                      <span className="text-slate-500">Agent:</span><span className="text-cyan-400 font-bold text-right truncate">{l.agent_name}</span>
                      <span className="text-slate-500">Node:</span><span className="text-white text-right">{l.kiosk_code}</span>
                      <span className="text-slate-500">Time:</span><span className="text-slate-300 text-right">{l.check_in_time}</span>
                      <span className="text-slate-500">Status:</span><span className="text-green-500 text-right font-black">Verified</span>
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}

            {data.kiosks.map(k => (
              <Marker key={`k-${k.id}`} position={[+k.latitude, +k.longitude]} icon={createIcon(Store, '#3b82f6')} ref={el => (mRefs.current[k.id] = el)}>
                <Popup className="custom-popup">
                  <div className="p-3 min-w-50 bg-[#0a1120] text-slate-200 rounded-xl border border-white/10 shadow-2xl font-sans">
                    <div className="flex items-center gap-2 mb-2 border-b border-white/5 pb-2"><MapPin size={14} className="text-blue-500"/><span className="font-black uppercase text-[10px] tracking-tighter">Station Profile</span></div>
                    <div className="grid grid-cols-2 gap-y-1.5 text-[9px] font-mono uppercase mb-2">
                      <span className="text-slate-500">Asset:</span><span className="text-blue-400 font-bold text-right">{k.kiosk_code}</span>
                      <span className="text-slate-500">Health:</span><span className="text-green-500 text-right font-black">Active</span>
                    </div>
                    {k.image_url ? <div className="relative rounded-lg overflow-hidden border border-white/10"><img src={k.image_url} className="w-full h-20 object-cover opacity-80" alt="Node"/><div className="absolute inset-0 bg-linear-to-t from-black/60 to-transparent" /></div> : <div className="h-12 bg-white/5 rounded-lg border border-dashed border-white/10 flex items-center justify-center text-[8px] text-slate-600 uppercase font-black">No Visual Data</div>}
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>

        {/* DEPLOY DRAWER */}
        <motion.div animate={{ x: ui.drawer ? 0 : '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} className="fixed top-1/2 -translate-y-1/2 right-0 w-96 h-[75%] bg-[#0a1120]/95 backdrop-blur-xl z-[1000] border-l border-white/10 rounded-l-[2.5rem] p-8 flex flex-col shadow-[-20px_0_50px_rgba(0,0,0,0.5)]">
          <button onClick={() => setUi(p => ({ ...p, drawer: !p.drawer }))} className="absolute left-0 top-1/2 -translate-x-full -translate-y-1/2 bg-blue-600 text-white w-10 h-32 rounded-l-2xl flex items-center justify-center cursor-pointer border-none shadow-xl hover:bg-blue-500 transition-all active:scale-95">
            <div className="rotate-90 text-[10px] font-black uppercase tracking-[0.3em]">{ui.drawer ? 'Close' : 'Deploy'}</div>
          </button>
          <div className="mb-8 text-center"><h2 className="text-sm font-black text-blue-400 uppercase tracking-widest italic">Kiosk Code Initialization</h2><div className="h-1 w-12 bg-blue-600 mx-auto mt-2 rounded-full shadow-[0_0_10px_#2563eb]"></div></div>
          <div className="flex-1 overflow-y-auto custom-scrollbar space-y-6 pr-2">
            <div className="bg-white p-6 rounded-4xl flex flex-col items-center shadow-inner group relative">
              <QRCodeSVG id="qr-gen" value={kiosk.fullKioskCode || "NEO-PENDING"} size={140} level="H"/>
              {kiosk.fullKioskCode && <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={handleDownloadQR} className="absolute top-2 right-2 p-2 bg-blue-600 rounded-full text-white hover:bg-blue-500 shadow-lg"><Download size={14}/></motion.button>}
              <div className="mt-4 px-4 py-1.5 bg-slate-100 rounded-full font-mono text-[11px] font-black text-slate-900 uppercase">{kiosk.fullKioskCode || "NEO-PENDING"}</div>
            </div>
            <div className="space-y-4">
              <select value={kiosk.areaId} onChange={e => onAreaSel(e.target.value)} className="w-full bg-[#050a14] border border-white/10 rounded-2xl p-4 text-xs text-white outline-none focus:border-blue-500 appearance-none font-bold"><option value="">Select Cluster...</option>{data.areas.map(a => <option key={a.id} value={a.id}>{a.name} ({a.abbr})</option>)}</select>
              <div className="grid grid-cols-2 gap-3">
                <input placeholder="LAT" inputMode="decimal" value={kiosk.lat} onChange={e => handleCoordChange('lat', e.target.value)} className="bg-[#050a14] border border-white/10 rounded-2xl p-4 text-xs text-white outline-none focus:border-blue-500 font-mono italic text-center"/>
                <input placeholder="LNG" inputMode="decimal" value={kiosk.lng} onChange={e => handleCoordChange('lng', e.target.value)} className="bg-[#050a14] border border-white/10 rounded-2xl p-4 text-xs text-white outline-none focus:border-blue-500 font-mono italic text-center"/>
              </div>
              <div className="relative h-28 bg-[#050a14] rounded-2xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center overflow-hidden hover:border-blue-500 transition-all cursor-pointer">
                <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={e => setFile(e.target.files[0])}/>
                {file ? <img src={URL.createObjectURL(file)} className="h-full w-full object-cover" alt="Pre"/> : <div className="flex flex-col items-center gap-2 text-slate-600"><Camera size={24}/><span className="text-[8px] font-black uppercase">Attach Photo</span></div>}
              </div>
            </div>
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => setUi(p => ({ ...p, confirm: true }))} className="w-full py-5 bg-blue-600 rounded-2xl text-[10px] font-black text-white uppercase tracking-[0.3em] shadow-[0_10px_20px_rgba(37,99,235,0.3)] hover:bg-blue-500 transition-all cursor-pointer">Authorize</motion.button>
          </div>
        </motion.div>
      </div>

      {/* MODALS & CONFIRMATION (SAME AS BEFORE) */}
      <AnimatePresence>
        {ui.modal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/90 backdrop-blur-md z-[2000] flex items-center justify-center p-6">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-[#0a1120] border border-white/10 w-full max-w-5xl rounded-4xl p-10 flex flex-col h-[85vh] relative shadow-2xl">
              <button onClick={() => setUi(p => ({ ...p, modal: false }))} className="absolute right-8 top-8 bg-white/5 p-3 rounded-full text-slate-500 hover:text-white transition-all cursor-pointer"><X size={24}/></button>
              <div className="flex items-center gap-4 mb-10"><div className="w-2 h-10 bg-blue-600 rounded-full"/><h3 className="text-2xl font-black uppercase text-white tracking-widest italic">Clusters</h3></div>
              <div className="flex flex-1 gap-12 overflow-hidden">
                <div className="w-80 flex flex-col gap-6 border-r border-white/5 pr-10">
                  <input placeholder="Name" className="w-full bg-[#050a14] border border-white/10 rounded-2xl p-4 text-xs text-white outline-none" value={area.name} onChange={e => { const n = e.target.value; setArea({ name: n, abbr: n.replace(/\s/g, '').toUpperCase().substring(0, 3) }); }} />
                  <input placeholder="Code" maxLength={5} className="w-full bg-[#050a14] border border-white/10 rounded-2xl p-4 text-xs text-white outline-none uppercase font-mono italic" value={area.abbr} onChange={e => setArea({ ...area, abbr: e.target.value.replace(/\s/g, '').toUpperCase() })} />
                  <button onClick={async () => { if(!area.name || !area.abbr) return alert("Required"); await supabase.from('area_clusters').insert([{ name: area.name, abbr: area.abbr.toUpperCase() }]); fetchAll(); setArea({ name: "", abbr: "" }); }} className="w-full py-5 bg-blue-600 rounded-2xl text-[10px] font-black text-white cursor-pointer uppercase hover:bg-blue-500 transition-all">Sync Cluster</button>
                </div>
                <div className="flex-1 overflow-y-auto bg-black/30 rounded-4xl border border-white/5 p-8">
                  <table className="w-full text-left text-[11px]"><tbody className="divide-y divide-white/5">{data.areas.map(a => (<tr key={a.id} className="hover:bg-white/5 transition-all"><td className="py-5 font-bold text-white">{a.name}</td><td className="py-5 font-mono text-blue-400">{a.abbr}</td><td className="py-5 text-right text-slate-600">#{a.id}</td></tr>))}</tbody></table>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {ui.confirm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[3000] flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="bg-[#0a1120] border border-white/10 w-full max-w-sm rounded-[3rem] p-10 text-center shadow-2xl">
              <div className="w-20 h-20 bg-blue-600/10 rounded-full flex items-center justify-center mx-auto mb-8 border border-blue-500/20"><CheckCircle2 size={36} className="text-blue-500 animate-pulse"/></div>
              <h3 className="text-xl font-black text-white uppercase mb-3">Initialize?</h3><p className="text-[11px] text-slate-400 mb-10 font-mono tracking-tighter">ID: <span className="text-blue-400">{kiosk.fullKioskCode}</span></p>
              <div className="flex flex-col gap-3">
                <button onClick={onDeploy} disabled={ui.loading} className="w-full py-5 bg-blue-600 rounded-2xl text-[10px] font-black text-white uppercase tracking-widest cursor-pointer shadow-lg">{ui.loading ? "SYNCING..." : "DEPLOY"}</button>
                <button onClick={() => setUi(p => ({ ...p, confirm: false }))} className="w-full py-5 bg-slate-800 rounded-2xl text-[10px] font-black text-slate-500 uppercase cursor-pointer">Cancel</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 20px; }
        .leaflet-container { background: #050a14 !important; }
        .grab-route-active { stroke-dasharray: 10, 15; animation: rf 1s linear infinite; filter: drop-shadow(0 0 8px #22d3ee); }
        @keyframes rf { from { stroke-dashoffset: 25; } to { stroke-dashoffset: 0; } }
        .custom-popup .leaflet-popup-content-wrapper { background: transparent !important; padding: 0 !important; box-shadow: none !important; }
        .custom-popup .leaflet-popup-tip { background: #0a1120 !important; border: 1px solid rgba(255,255,255,0.1); }
        .custom-popup .leaflet-popup-content { margin: 0 !important; }
        .perspective-1000 { perspective: 1000px; }
        .preserve-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; }
        .rotate-y-180 { transform: rotateY(180deg); }
      `}</style>
    </div>
  );
}