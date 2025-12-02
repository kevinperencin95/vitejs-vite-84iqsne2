import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useZxing } from "react-zxing"; 
import { Truck, Navigation, Fuel, Save, User, LogOut, MapPin, Camera, X, Check, Clock, Wifi, ChevronDown, Lock, Droplet, CreditCard, ArrowRight, AlertTriangle, RefreshCw, History, Users, Calendar, AlertOctagon, FileText, Radio } from 'lucide-react';

// ==========================================================================================
// ⚠️ CONFIGURAZIONE API ⚠️
// ==========================================================================================
const API_URL = "https://script.google.com/macros/s/AKfycbz8mQgiROz0RkNHE5gSbUkyy8VyDu-09Cqx_UJlpFLHDyaj6NXtt5v_ArSlGwTdxi3T/exec"; 

// ==========================================================================================
// --- GESTORE DATI (Backend) ---
// ==========================================================================================

const MOCK_DATA = {
    drivers: { '12345': 'Mario Rossi', '67890': 'Luigi Verdi' },
    driversList: [ { matricola: '12345', name: 'Mario Rossi' }, { matricola: '67890', name: 'Luigi Verdi' } ],
    vehicles: [ { targa: 'AA 123 BB', modello: 'Fiat Ducato' }, { targa: 'CC 456 DD', modello: 'Iveco Daily' } ],
    stations: [{ id: 1, nome: 'Distributore Sede' }],
    history: [], driverHistory: []
};

const isDemo = () => API_URL.includes("INSERISCI") || API_URL === "";

const apiCall = async (action, params = '') => {
    if (isDemo()) return null; 
    try {
        const res = await fetch(`${API_URL}?action=${action}${params}`);
        return await res.json();
    } catch (e) { 
        console.error(`Err ${action}`, e); 
        return null; 
    }
};

// 1. CHECK REMOTO (Fondamentale per la richiesta)
const apiCheckRemoteUpdates = async (driverName) => {
  if (isDemo()) return { found: false };
  try {
    const res = await fetch(`${API_URL}?action=checkRemoteStart&driverName=${driverName}`);
    return await res.json();
  } catch (error) { return { found: false }; }
};

const apiStartShift = async (payload) => {
    if (isDemo()) return;
    fetch(API_URL, { method: 'POST', body: JSON.stringify({ ...payload, type: 'START' }) }).catch(console.error);
};

const apiLogFuel = async (session, fuelData) => {
    if (isDemo()) return { success: true };
    try {
        const payload = {
          type: 'FUEL',
          driver: session.user.matricola,
          driverName: session.user.name,
          targa: session.targa,
          ...fuelData
        };
        await fetch(API_URL, { method: 'POST', body: JSON.stringify(payload) });
        return { success: true };
    } catch (e) { return { success: false }; }
};

const apiSaveLog = async (payload) => {
    if (isDemo()) return { success: true };
    try {
        await fetch(API_URL, { method: 'POST', body: JSON.stringify({ ...payload, type: 'END' }) });
        return { success: true };
    } catch (e) { return { success: false }; }
};

// ==========================================================================================
// --- COMPONENTI UI ---
// ==========================================================================================

const Button = ({ onClick, children, variant = 'primary', className = '', disabled = false, icon: Icon }) => {
  const variants = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200",
    success: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-200",
    danger: "bg-red-500 text-white hover:bg-red-600 shadow-red-200",
    warning: "bg-orange-500 text-white hover:bg-orange-600 shadow-orange-200",
    outline: "border-2 border-gray-200 text-gray-600 hover:bg-gray-50 bg-white"
  };
  return (
    <button onClick={onClick} disabled={disabled} className={`w-full py-4 rounded-xl font-bold flex items-center justify-center transition-all active:scale-95 shadow-md text-sm uppercase tracking-wide ${variants[variant]} ${disabled ? 'opacity-50' : ''} ${className}`}>
      {Icon && <Icon className="w-5 h-5 mr-2" />} {children}
    </button>
  );
};

const Input = ({ label, type = "text", value, onChange, placeholder, autoFocus, className = '' }) => (
  <div className="mb-4">
    <label className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">{label}</label>
    <input type={type} value={value} onChange={onChange} placeholder={placeholder} autoFocus={autoFocus} className={`w-full p-4 bg-gray-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-xl focus:outline-none font-bold text-gray-800 ${className}`} />
  </div>
);

// --- SCANNER ---
const BarcodeScanner = ({ onScan, onClose }) => {
  const { ref } = useZxing({
    onDecodeResult(result) {
      const code = result.getText();
      if (navigator.vibrate) navigator.vibrate(200);
      onScan(code);
    },
    onError(error) { },
    constraints: { video: { facingMode: "environment" } }
  });

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col">
       <div className="absolute top-0 w-full p-4 flex justify-between z-10 text-white bg-gradient-to-b from-black/80 to-transparent">
         <span className="font-bold tracking-wider">SCANNER ATTIVO</span>
         <button onClick={onClose} className="bg-white/20 p-2 rounded-full"><X size={20}/></button>
       </div>
       <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
          <video ref={ref} className="w-full h-full object-cover opacity-90" />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
             <div className="w-80 h-48 border-2 border-red-500/50 rounded-xl relative shadow-[0_0_0_9999px_rgba(0,0,0,0.6)]">
                <div className="w-full h-0.5 bg-red-500 absolute top-1/2 -translate-y-1/2 animate-pulse shadow-[0_0_20px_red]"></div>
             </div>
          </div>
          <p className="absolute bottom-20 text-white/90 text-sm font-medium px-6 py-3 text-center bg-black/60 backdrop-blur-sm rounded-full mx-4">
             Inquadra il codice a barre
          </p>
       </div>
    </div>
  );
};

// --- SCREEN ATTESA ---
const PreloadCheckScreen = () => (
  <div className="flex flex-col items-center justify-center min-h-screen bg-blue-600 text-white p-8">
     <div className="bg-white/20 p-6 rounded-full mb-6 animate-pulse">
        <RefreshCw className="w-12 h-12 animate-spin" />
     </div>
     <h2 className="text-2xl font-bold mb-2">Verifica Turno...</h2>
     <p className="text-blue-100 text-center opacity-90">Controllo dati ufficio in corso.</p>
  </div>
);

// --- MODALI ---
const HistoryModal = ({ title, data, onClose }) => (
  <div className="fixed inset-0 z-[90] bg-black/80 flex items-center justify-center p-4 animate-in fade-in">
    <div className="bg-white w-full max-w-sm rounded-3xl p-6 flex flex-col max-h-[80vh]">
      <div className="flex justify-between mb-4 border-b pb-2"><h3 className="font-bold">{title}</h3><button onClick={onClose}><X/></button></div>
      <div className="flex-1 overflow-y-auto space-y-2">
        {data.length === 0 ? <p className="text-center text-gray-400 py-4">Nessun dato.</p> : data.map((i, k) => (
            <div key={k} className="bg-gray-50 p-3 rounded-xl border border-gray-100 text-sm">
                <div className="flex justify-between font-bold text-gray-700"><span>{i.date || i.driver}</span><span>{i.targa}</span></div>
                <div className="flex justify-between text-xs text-gray-500 mt-1"><span>{i.start ? `Start: ${i.start}` : `Fine: ${i.km}`}</span><span>{i.total ? `Tot: ${i.total}km` : ''}</span></div>
            </div>
        ))}
      </div>
      <button onClick={onClose} className="mt-4 w-full py-3 bg-gray-100 rounded-xl font-bold text-gray-500">Chiudi</button>
    </div>
  </div>
);

const FuelModal = ({ onClose, onSave }) => {
  const [form, setForm] = useState({ importo: '', litri: '', tessera: '', impianto: '' });
  const [stations, setStations] = useState([]);
  const [sending, setSending] = useState(false);

  useEffect(() => { 
      if(isDemo()) setStations(MOCK_DATA.stations);
      else apiCall('getStations').then(d => setStations(d || []));
  }, []);

  const save = async () => {
      if (!form.importo || !form.litri) return alert("Inserisci dati.");
      setSending(true);
      await onSave(form);
      setSending(false);
      onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/80 flex items-end justify-center animate-in slide-in-from-bottom-10">
      <div className="bg-white w-full max-w-md rounded-t-3xl p-6">
        <div className="flex justify-between mb-4"><h3 className="font-bold text-lg flex gap-2"><Fuel className="text-orange-500"/> Rifornimento</h3><button onClick={onClose}><X/></button></div>
        <div className="grid grid-cols-2 gap-4">
            <Input label="Euro (€)" type="number" value={form.importo} onChange={e => setForm({...form, importo: e.target.value})} />
            <Input label="Litri" type="number" value={form.litri} onChange={e => setForm({...form, litri: e.target.value})} />
        </div>
        <Input label="Tessera" value={form.tessera} onChange={e => setForm({...form, tessera: e.target.value})} />
        <div className="mb-4">
            <label className="text-xs font-bold text-gray-500 ml-1">Impianto</label>
            <select className="w-full p-4 bg-gray-50 rounded-xl font-bold border-2 border-transparent" onChange={e => setForm({...form, impianto: e.target.value})}>
                <option value="">Seleziona...</option>
                {stations.map((s, i) => <option key={i} value={s.nome}>{s.nome}</option>)}
            </select>
        </div>
        <Button onClick={save} variant="warning" disabled={sending}>{sending ? 'Invio...' : 'REGISTRA'}</Button>
      </div>
    </div>
  );
};

// ==========================================================================================
// --- APP LOGIC ---
// ==========================================================================================

export default function App() {
  const [view, setView] = useState('LOGIN');
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(false);
  
  // Dati
  const [vehicles, setVehicles] = useState([]);
  const [history, setHistory] = useState([]);
  const [myHistory, setMyHistory] = useState([]);

  // Input Start
  const [targa, setTarga] = useState('');
  const [km, setKm] = useState('');
  const [warning, setWarning] = useState(false);
  
  // Input End
  const [endKm, setEndKm] = useState('');

  // Modali
  const [showScanner, setShowScanner] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showMyHistory, setShowMyHistory] = useState(false);
  const [showFuel, setShowFuel] = useState(false);
  
  // Persistenza
  useEffect(() => {
    const saved = localStorage.getItem('driver_session_v25');
    if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.session && parsed.session.date === new Date().toISOString().split('T')[0]) {
            setUser(parsed.user);
            setSession(parsed.session);
            setView('ACTIVE');
        }
    }
  }, []);

  const updateSession = (newSession) => {
      setSession(newSession);
      localStorage.setItem('driver_session_v25', JSON.stringify({ user, session: newSession }));
  };

  // SYNC LIVE
  useEffect(() => {
      if (view !== 'ACTIVE' || !session) return;
      const interval = setInterval(async () => {
          const res = await apiCheckRemoteUpdates(session.driverName);
          if (res && res.found) {
             let hasUpdates = false;
             let updatedSession = { ...session };
             
             if (res.startKm && res.startKm !== session.startKm) {
                 updatedSession.startKm = res.startKm;
                 updatedSession.anomaly = false; 
                 hasUpdates = true;
             }
             if (res.targa && res.targa !== session.targa) {
                 updatedSession.targa = res.targa;
                 hasUpdates = true;
             }
             if (hasUpdates) {
                 updateSession(updatedSession);
                 console.log("Sync Ufficio: Dati allineati.");
             }
          }
      }, 10000);
      return () => clearInterval(interval);
  }, [session, view]);

  // --- AZIONI ---

  const doLogin = async (matricola) => {
      if (!matricola) return;
      setLoading(true);
      
      // 1. Recupera nome autista dal DB
      let driverName = "Autista";
      const driverRes = await apiCall('getDriver', `&matricola=${matricola}`);
      
      if (driverRes && driverRes.success) {
         driverName = driverRes.name;
      } else if (!isDemo()) { 
         alert("Matricola non trovata. Controlla il foglio 'Autisti'."); 
         setLoading(false); 
         return; 
      }
      
      const userData = { matricola, name: driverName };
      setUser(userData);
      
      // 2. MOSTRA SCHERMATA DI ATTESA (UX Feedback)
      setView('CHECKING_PRELOAD');

      // 3. CONTROLLO PRE-CARICO UFFICIO
      // Chiede al backend se esiste una riga nel foglio ControlloKM per questo autista OGGI
      const remoteCheck = await apiCall('checkRemoteStart', `&driverName=${driverName}`);
      
      setLoading(false); 

      if (remoteCheck && remoteCheck.found && remoteCheck.startKm) {
          // CASO A: Ufficio ha già inserito i dati -> VAI SUBITO ALLA SCHERMATA CENTRALE
          const newSession = {
              date: new Date().toISOString().split('T')[0],
              startTime: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}),
              driverName: driverName,
              targa: remoteCheck.targa,
              startKm: remoteCheck.startKm,
              fuelLogs: [],
              anomaly: false,
              fromOffice: true // Flag per indicare provenienza ufficio
          };
          updateSession(newSession);
          setView('ACTIVE'); 
      } else {
          // CASO B: Nessun dato ufficio -> VAI A INSERIMENTO MANUALE (Procedura Standard)
          const vData = await apiCall('getVehicles');
          setVehicles(vData || []);
          setView('START');
      }
  };

  const doStart = () => {
      if (!targa || !km) return;
      const kmi = parseInt(km);
      
      // Check Anomalia Locale
      const selectedV = vehicles.find(v => v.targa === targa);
      let isAnomaly = false;
      if (selectedV && selectedV.lastKm && kmi < selectedV.lastKm) {
          if (!warning) {
              setWarning(true);
              alert(`ATTENZIONE: KM INFERIORI ALLO STORICO!\nUltimo: ${selectedV.lastKm}\nTuoi: ${kmi}\n\nPremi di nuovo per confermare.`);
              return;
          }
          isAnomaly = true;
      }

      const newSession = {
          date: new Date().toISOString().split('T')[0],
          startTime: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}),
          driverName: user.name,
          targa: targa,
          startKm: kmi,
          fuelLogs: [],
          anomaly: isAnomaly,
          fromOffice: false
      };
      
      updateSession(newSession);
      setView('ACTIVE');
      apiStartShift({ ...newSession, user });
  };

  const doFuel = async (data) => {
      await apiLogFuel(session, data);
      const updated = { ...session, fuelLogs: [...session.fuelLogs, data] };
      updateSession(updated);
  };

  const doEnd = async () => {
      if (!endKm) return alert("Mancano i KM finali");
      setLoading(true);
      
      const finalData = {
          ...session,
          driver: user.matricola,
          end: parseInt(endKm),
          totalKm: parseInt(endKm) - session.startKm
      };

      const res = await apiSaveLog(finalData);
      setLoading(false);
      
      if (res.success) {
          localStorage.removeItem('driver_session_v25');
          setSession(null); setUser(null); setTarga(''); setKm(''); setEndKm('');
          setView('LOGIN');
      }
  };

  // --- RENDER ---

  if (view === 'LOGIN') return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6">
       {showScanner && <BarcodeScanner onScan={(code) => { setShowScanner(false); doLogin(code); }} onClose={() => setShowScanner(false)} />}
       <div className="bg-white/10 p-6 rounded-3xl mb-8"><Truck className="text-blue-400 w-16 h-16"/></div>
       <h1 className="text-white text-4xl font-black mb-8">Driver<span className="text-blue-500">App</span></h1>
       <div className="bg-white p-6 rounded-2xl w-full max-w-sm shadow-2xl">
          <Button onClick={() => setShowScanner(true)} className="mb-6" icon={Camera}>SCANSIONA BADGE</Button>
          <div className="relative border-t border-gray-100 pt-6 text-center"><span className="bg-white px-2 text-xs text-gray-400 font-bold -mt-9 block w-max mx-auto">OPPURE</span></div>
          <div className="flex gap-2 mt-4">
             <input className="w-full bg-gray-100 rounded-xl p-4 font-bold text-center outline-none focus:ring-2 focus:ring-blue-500" placeholder="Matricola" value={matricola} onChange={e => setMatricola(e.target.value)} />
             <button onClick={() => doLogin(matricola)} disabled={loading} className="bg-blue-600 text-white px-6 rounded-xl font-bold">{loading ? '...' : <Check/>}</button>
          </div>
       </div>
    </div>
  );

  if (view === 'CHECKING_PRELOAD') return <PreloadCheckScreen />;

  if (view === 'START') return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
       {showHistory && <HistoryModal title="Storico Veicolo" data={history} onClose={() => setShowHistory(false)} />}
       {showMyHistory && <HistoryModal title="I Miei Turni" data={myHistory} onClose={() => setShowMyHistory(false)} />}

       <div className="bg-white p-6 shadow-sm z-10 flex justify-between items-center border-b border-gray-100">
          <div><h2 className="text-xl font-bold">Ciao, {user.name.split(' ')[0]}</h2><p className="text-xs text-gray-400">Inizia il tuo turno</p></div>
          <div className="bg-blue-100 p-2 rounded-full text-blue-600"><User/></div>
       </div>

       <div className="flex-1 p-6 overflow-y-auto space-y-6">
          <button onClick={() => { apiCall('getDriverHistory', `&matricola=${user.matricola}`).then(setMyHistory); setShowMyHistory(true); }} className="w-full py-3 bg-white border-2 border-blue-100 rounded-xl text-blue-600 font-bold text-sm flex items-center justify-center gap-2"><Clock size={16}/> Le mie ultime 14 registrazioni</button>
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
             <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">VEICOLO</label>
             <div className="relative">
                <select className="w-full p-4 bg-gray-50 rounded-xl font-bold appearance-none outline-none" onChange={e => { setTarga(e.target.value); setWarning(false); apiCall('getHistory', `&targa=${e.target.value}`).then(setHistory); }}>
                   <option value="">Seleziona...</option>
                   {vehicles.map((v, i) => <option key={i} value={v.targa}>{v.targa} - {v.modello}</option>)}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"/>
             </div>
             {targa && <div className="mt-2 flex justify-end"><button onClick={() => setShowHistory(true)} className="text-xs font-bold text-blue-500 flex items-center gap-1"><History size={12}/> Chi l'ha usato?</button></div>}
          </div>
          <div className={`bg-white p-6 rounded-3xl shadow-sm border ${warning ? 'border-red-500 ring-2 ring-red-100' : 'border-gray-100'}`}>
             <label className={`text-xs font-bold uppercase tracking-wider block mb-2 ${warning ? 'text-red-500' : 'text-gray-400'}`}>{warning ? 'CONFERMA KM (ANOMALIA)' : 'KM INIZIALI'}</label>
             <div className="flex items-center gap-2">
                <input type="number" className={`w-full text-3xl font-mono font-bold outline-none ${warning ? 'text-red-600' : ''}`} placeholder="000000" value={km} onChange={e => { setKm(e.target.value); setWarning(false); }} />
                <span className="font-bold text-sm text-gray-400">KM</span>
             </div>
             {warning && <p className="text-xs text-red-500 font-bold mt-2 animate-pulse">⚠️ Inferiori allo storico! Premi AVVIA per confermare.</p>}
          </div>
       </div>
       <div className="p-6 bg-white border-t border-gray-100">
          <Button onClick={doStart} disabled={!targa || !km} variant={warning ? 'danger' : 'primary'}>{warning ? 'CONFERMA ANOMALIA' : 'INIZIA SERVIZIO'}</Button>
       </div>
    </div>
  );

  if (view === 'ACTIVE') return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
       {showFuel && <FuelModal onClose={() => setShowFuel(false)} onSave={doFuel} />}
       
       <div className="bg-slate-900 text-white p-8 rounded-b-[2.5rem] shadow-2xl relative overflow-hidden">
          <div className="relative z-10">
             <div className="flex justify-between items-start mb-6">
                <div className="bg-green-500/20 border border-green-500/50 text-green-400 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest flex items-center gap-2"><span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"/> IN VIAGGIO</div>
                {session.anomaly && <div className="bg-red-500/20 border border-red-500/50 text-red-400 px-2 py-1 rounded-full text-[10px] font-bold uppercase"><AlertOctagon size={12} className="inline mr-1"/> ANOMALIA</div>}
             </div>
             <h2 className="text-4xl font-black mb-1">{session.targa}</h2>
             <div className="flex items-center gap-2 text-slate-400 text-sm font-medium mb-4">
                 <User size={14}/> {session.driverName} 
                 <span className="text-[10px] bg-blue-900/50 px-2 py-0.5 rounded border border-blue-500/30 flex items-center gap-1 ml-2"><RefreshCw size={10} className="animate-spin-slow"/> Live Sync</span>
             </div>
             
             <div className="grid grid-cols-2 gap-4 mt-2">
                <div className="bg-white/10 p-3 rounded-xl backdrop-blur-sm"><p className="text-[10px] text-slate-400 font-bold uppercase">Start</p><p className={`text-xl font-mono ${session.anomaly ? 'text-red-400' : ''}`}>{session.startKm} <span className="text-xs text-slate-500">km</span></p></div>
                <div className="bg-white/10 p-3 rounded-xl backdrop-blur-sm"><p className="text-[10px] text-slate-400 font-bold uppercase">Orario</p><p className="text-xl font-mono">{session.startTime}</p></div>
             </div>
          </div>
       </div>

       <div className="flex-1 p-6 flex flex-col justify-between">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 text-center">
             {session.fuelLogs.length > 0 ? (
                 <div className="mb-6 bg-orange-50 p-4 rounded-2xl border border-orange-100 animate-in fade-in"><p className="text-orange-800 font-bold flex items-center justify-center gap-2 mb-1"><Check size={16}/> Rifornimento OK</p><p className="text-xs text-orange-600 opacity-80">Ultimo inserimento salvato</p></div>
             ) : <p className="text-sm text-gray-400 mb-6">Nessun rifornimento registrato.</p>}
             <Button onClick={() => setShowFuel(true)} variant="warning" icon={Fuel}>REGISTRA RIFORNIMENTO</Button>
          </div>
          <Button onClick={() => setView('END')} variant="danger" icon={LogOut} className="shadow-lg shadow-red-200">TERMINA TURNO</Button>
       </div>
    </div>
  );

  if (view === 'END') return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-white p-6 shadow-sm z-10"><h2 className="text-xl font-bold text-gray-900">Chiusura Turno</h2></div>
      <div className="flex-1 p-6 overflow-y-auto space-y-6">
         <div className="bg-white p-8 rounded-3xl shadow-lg border border-gray-100 mb-6 text-center">
            <p className="text-sm text-gray-400 font-bold uppercase tracking-widest mb-6">Inserisci KM Finali</p>
            <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 mb-8 inline-block w-full">
                <p className="text-xs text-blue-600 font-bold uppercase mb-1">Partenza</p>
                <p className={`text-3xl font-mono font-black ${session.anomaly ? 'text-red-500' : 'text-blue-900'}`}>{session.startKm}</p>
                {session.anomaly && <p className="text-[10px] text-red-500 font-bold mt-1 animate-pulse">ANOMALIA START</p>}
            </div>
            <input type="number" autoFocus className="w-full text-center text-5xl font-bold text-gray-800 outline-none bg-transparent placeholder-gray-200" placeholder="000000" value={endKm} onChange={e => setEndKm(e.target.value)} />
         </div>
         {endKm && parseInt(endKm) > session.startKm && (
             <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 flex justify-between items-center animate-in slide-in-from-bottom-4">
                <span className="text-sm font-bold text-emerald-700">Totale Percorso</span>
                <span className="text-2xl font-black text-emerald-600">{parseInt(endKm) - session.startKm} <span className="text-sm font-normal">km</span></span>
             </div>
         )}
      </div>
      <div className="p-6 bg-white border-t border-gray-100 flex gap-4">
         <button onClick={() => setView('ACTIVE')} className="font-bold text-gray-400 px-4">Indietro</button>
         <Button onClick={doEnd} disabled={loading} variant="success" icon={Check}>{loading ? 'Salvataggio...' : 'CONFERMA CHIUSURA'}</Button>
      </div>
    </div>
  );

  return null;
}