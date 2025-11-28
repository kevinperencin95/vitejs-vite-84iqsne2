import React, { useState, useEffect, useRef } from 'react';
import { Truck, Navigation, Fuel, Save, User, LogOut, MapPin, Camera, X, Check, Clock, Wifi, ChevronDown, Lock, Droplet, CreditCard, ArrowRight, AlertTriangle, RefreshCw, History, Users, Calendar, AlertOctagon, FileText, Radio } from 'lucide-react';

// ==========================================================================================
// ⚠️ CONFIGURAZIONE API GOOGLE SHEETS ⚠️
// ==========================================================================================

const API_URL = "https://script.google.com/macros/s/AKfycbz8mQgiROz0RkNHE5gSbUkyy8VyDu-09Cqx_UJlpFLHDyaj6NXtt5v_ArSlGwTdxi3T/exec"; 

// ==========================================================================================
// --- GESTORE CHIAMATE API ---
// ==========================================================================================

const MOCK_DATA = {
    drivers: { '12345': 'Mario Rossi (Demo)', '67890': 'Luigi Verdi (Demo)' },
    vehicles: [
        { targa: 'AA 123 BB', modello: 'Fiat Ducato (Demo)', lastKm: 154300, lastDriver: 'Luigi V.' },
        { targa: 'CC 456 DD', modello: 'Iveco Daily (Demo)', lastKm: 89000, lastDriver: 'Mario R.' }
    ],
    stations: [{ id: 1, nome: 'Distributore Demo' }],
    history: [],
    driverHistory: []
};

const isDemoMode = () => API_URL.includes("INSERISCI_QUI") || API_URL === "";

const apiFetchDriverName = async (matricola) => {
  if (isDemoMode()) { await new Promise(r => setTimeout(r, 500)); return MOCK_DATA.drivers[matricola] ? { success: true, name: MOCK_DATA.drivers[matricola] } : { success: false }; }
  try {
    const res = await fetch(`${API_URL}?action=getDriver&matricola=${matricola}`);
    return await res.json();
  } catch (error) {
    console.error("Errore Driver:", error);
    return { success: false, error: "Errore connessione" };
  }
};

const apiFetchVehicles = async () => {
  if (isDemoMode()) return MOCK_DATA.vehicles;
  try {
    const response = await fetch(`${API_URL}?action=getVehicles`);
    const text = await response.text();
    try {
        const data = JSON.parse(text);
        return Array.isArray(data) ? data : [];
    } catch (e) { return []; }
  } catch (error) { return []; }
};

const apiFetchVehicleHistory = async (targa) => {
  if (isDemoMode()) { await new Promise(r => setTimeout(r, 800)); return MOCK_DATA.history || []; }
  try {
    const res = await fetch(`${API_URL}?action=getHistory&targa=${targa}`);
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (error) { return []; }
};

const apiFetchDriverPersonalHistory = async (matricola) => {
  if (isDemoMode()) { await new Promise(r => setTimeout(r, 800)); return MOCK_DATA.driverHistory || []; }
  try {
    const res = await fetch(`${API_URL}?action=getDriverHistory&matricola=${matricola}`);
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (error) { return []; }
};

const apiFetchStations = async () => {
  if (isDemoMode()) return MOCK_DATA.stations;
  try {
    const res = await fetch(`${API_URL}?action=getStations`);
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (error) { return []; }
};

// Funzione Sync che cerca aggiornamenti per l'autista corrente
const apiCheckRemoteUpdates = async (driverName) => {
  if (isDemoMode()) return { found: false };
  try {
    const res = await fetch(`${API_URL}?action=checkRemoteStart&driverName=${driverName}`);
    return await res.json();
  } catch (error) { return { found: false }; }
};

const apiStartShift = async (shiftData) => {
  if (isDemoMode()) return;
  try {
    const payload = { 
        type: 'START',
        targa: shiftData.targa,
        driver: shiftData.user ? shiftData.user.matricola : 'N/D',
        driverName: shiftData.user ? shiftData.user.name : 'Sconosciuto',
        start: shiftData.startKm, 
        anomaly: shiftData.anomaly
    };
    fetch(API_URL, { method: 'POST', body: JSON.stringify(payload) }).catch(e => console.error(e));
  } catch (error) { console.error("Err log start", error); }
};

const apiLogFuel = async (session, fuelData) => {
  if (isDemoMode()) { await new Promise(r => setTimeout(r, 1000)); return { success: true }; }
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
  } catch (error) {
    alert("Errore salvataggio rifornimento. Controlla connessione.");
    return { success: false };
  }
};

const apiSaveLog = async (logData) => {
  if (isDemoMode()) { await new Promise(r => setTimeout(r, 1000)); return { success: true }; }
  try {
    const payload = { ...logData, type: 'END' };
    await fetch(API_URL, { method: 'POST', body: JSON.stringify(payload) });
    return { success: true };
  } catch (error) {
    alert("Errore salvataggio finale.");
    return { success: false };
  }
};


// ==========================================================================================
// --- COMPONENTI UI ---
// ==========================================================================================

const Button = ({ onClick, children, variant = 'primary', className = '', disabled = false, icon: Icon }) => {
  const baseStyle = "w-full py-4 rounded-xl font-bold flex items-center justify-center transition-all active:scale-95 shadow-md text-sm uppercase tracking-wide";
  const variants = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200",
    success: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-200",
    danger: "bg-red-500 text-white hover:bg-red-600 shadow-red-200",
    warning: "bg-orange-500 text-white hover:bg-orange-600 shadow-orange-200",
    outline: "border-2 border-gray-200 text-gray-600 hover:bg-gray-50 bg-white"
  };
  return (
    <button onClick={onClick} disabled={disabled} className={`${baseStyle} ${variants[variant]} ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}>
      {Icon && <Icon className="w-5 h-5 mr-2" />} {children}
    </button>
  );
};

const Input = ({ label, type = "text", value, onChange, placeholder, autoFocus, className = '' }) => (
  <div className="mb-4">
    <label className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">{label}</label>
    <input type={type} value={value} onChange={onChange} placeholder={placeholder} autoFocus={autoFocus} className={`w-full p-4 bg-gray-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-xl focus:outline-none transition-all font-bold text-gray-800 ${className}`} />
  </div>
);

// --- MODULI SENSORI & MODALI ---

const DriverHistoryModal = ({ matricola, onClose }) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetchDriverPersonalHistory(matricola).then(data => { setHistory(data); setLoading(false); });
  }, [matricola]);

  return (
    <div className="fixed inset-0 z-[90] bg-black/80 flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white w-full max-w-sm rounded-3xl p-6 relative animate-in zoom-in-95 shadow-2xl flex flex-col max-h-[80vh]">
        <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-4">
          <div className="flex items-center gap-2">
             <div className="bg-blue-100 p-2 rounded-full text-blue-600"><FileText size={20}/></div>
             <div><h3 className="text-lg font-bold text-gray-900">I Miei Turni</h3><p className="text-[10px] text-gray-400 font-bold uppercase">Ultimi 14 giorni</p></div>
          </div>
          <button onClick={onClose} className="bg-gray-100 p-2 rounded-full hover:bg-gray-200"><X size={20}/></button>
        </div>
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {loading ? <div className="text-center py-8 text-gray-400 text-sm animate-pulse">Recupero dati...</div> : history.length > 0 ? history.map((item, idx) => (
              <div key={idx} className="bg-white border border-gray-100 rounded-xl p-3 shadow-sm hover:border-blue-200 transition-colors">
                <div className="flex justify-between items-start mb-2"><div className="flex items-center gap-1.5 text-xs font-bold text-gray-500 bg-gray-50 px-2 py-1 rounded-md"><Calendar size={12}/> {new Date(item.date).toLocaleDateString('it-IT')}</div><div className="text-right"><span className="text-xs font-bold bg-blue-50 text-blue-600 px-2 py-1 rounded-md">{item.targa}</span></div></div>
                <div className="flex justify-between items-end text-sm"><div><p className="text-[10px] text-gray-400 uppercase">Tratta</p><p className="text-gray-600 font-mono text-xs">{item.start} ➝ {item.end}</p></div><div className="text-right"><p className="text-[10px] text-gray-400 uppercase">Totale</p><p className="font-bold text-gray-800 text-base">{item.total} <span className="text-[10px] font-normal text-gray-400">km</span></p></div></div>
              </div>
            )) : <div className="text-center py-10"><div className="bg-gray-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3 text-gray-300"><FileText size={32}/></div><p className="text-gray-400 text-sm font-medium">Nessun turno registrato<br/>negli ultimi 14 giorni.</p></div>}
        </div>
        <div className="mt-4 pt-4 border-t border-gray-100 text-center"><button onClick={onClose} className="text-sm font-bold text-gray-400 hover:text-gray-600">Chiudi</button></div>
      </div>
    </div>
  );
};

const VehicleHistoryModal = ({ targa, onClose }) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetchVehicleHistory(targa).then(data => { setHistory(data); setLoading(false); });
  }, [targa]);

  return (
    <div className="fixed inset-0 z-[80] bg-black/80 flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white w-full max-w-sm rounded-3xl p-6 relative animate-in zoom-in-95 shadow-2xl">
        <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
          <div><h3 className="text-lg font-bold text-gray-900">Ultimi Utilizzatori</h3><p className="text-xs text-blue-600 font-bold">{targa}</p></div>
          <button onClick={onClose} className="bg-gray-100 p-2 rounded-full hover:bg-gray-200"><X size={20}/></button>
        </div>
        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
          {loading ? <div className="text-center py-8 text-gray-400">Caricamento dati...</div> : history.length > 0 ? history.map((item, idx) => (
              <div key={idx} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                <div className="bg-white p-2 rounded-full shadow-sm text-gray-400"><User size={16}/></div>
                <div className="flex-1"><p className="text-sm font-bold text-gray-800">{item.driver}</p><div className="flex items-center gap-2 text-xs text-gray-500"><span className="flex items-center gap-1"><Calendar size={10}/> {new Date(item.date).toLocaleDateString('it-IT')}</span></div></div>
                <div className="text-right"><p className="text-xs text-gray-400 uppercase font-bold">KM Fine</p><p className="font-mono font-bold text-gray-700">{item.km}</p></div>
              </div>
            )) : <div className="text-center py-8 text-gray-400 text-sm">Nessuno storico trovato.</div>}
        </div>
      </div>
    </div>
  );
};

const RefuelingModal = ({ onClose, onSave }) => {
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [formData, setFormData] = useState({ importo: '', litri: '', tessera: '', impianto: '' });

  useEffect(() => { apiFetchStations().then(data => { setStations(data); setLoading(false); }); }, []);

  const handleSubmit = async () => {
    if (!formData.importo || !formData.litri || !formData.impianto || !formData.tessera) return alert("Compila tutti i campi.");
    setIsSending(true);
    await onSave(formData);
    setIsSending(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/80 flex items-end sm:items-center justify-center animate-in fade-in">
      <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 relative animate-in slide-in-from-bottom-10">
        <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
          <div className="flex items-center gap-2"><div className="bg-orange-100 p-2 rounded-full"><Fuel className="text-orange-600 w-6 h-6"/></div><h3 className="text-xl font-bold text-gray-900">Nuovo Rifornimento</h3></div>
          <button onClick={onClose} className="bg-gray-100 p-2 rounded-full"><X size={20}/></button>
        </div>
        <div className="space-y-4 max-h-[60vh] overflow-y-auto pb-4">
          <div className="grid grid-cols-2 gap-4">
             <Input label="Importo (€)" type="number" placeholder="0.00" value={formData.importo} onChange={e => setFormData({...formData, importo: e.target.value})} />
             <Input label="Litri Erogati" type="number" placeholder="0.00" value={formData.litri} onChange={e => setFormData({...formData, litri: e.target.value})} />
          </div>
          <Input label="N. Tessera" placeholder="Es. 700012345" value={formData.tessera} onChange={e => setFormData({...formData, tessera: e.target.value})} />
          <div className="mb-4">
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">Impianto</label>
            <div className="relative">
              <select value={formData.impianto} onChange={e => setFormData({...formData, impianto: e.target.value})} className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-blue-500 rounded-xl appearance-none font-bold text-gray-800 outline-none">
                <option value="">{loading ? "Caricamento..." : "-- Seleziona --"}</option>
                {stations.map((s, i) => <option key={i} value={s.nome}>{s.nome}</option>)}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={20} />
            </div>
          </div>
        </div>
        <Button onClick={handleSubmit} disabled={isSending} variant="warning" icon={Check}>{isSending ? 'Salvataggio...' : 'Registra'}</Button>
      </div>
    </div>
  );
};

const NFCScanner = ({ onRead, onCancel }) => {
  const [status, setStatus] = useState('scanning');
  const simulateTouch = () => { setStatus('success'); if(navigator.vibrate) navigator.vibrate([50,50,50]); setTimeout(() => onRead('AA 123 BB'), 800); };
  return (
    <div className="fixed inset-0 z-[60] bg-black/90 flex flex-col items-center justify-center p-6 animate-in fade-in">
      <div className="bg-white w-full max-w-sm rounded-3xl p-8 text-center relative">
        <button onClick={onCancel} className="absolute top-4 right-4 p-2 bg-gray-100 rounded-full hover:bg-gray-200"><X size={20}/></button>
        <div className={`mx-auto w-20 h-20 rounded-full flex items-center justify-center mb-6 ${status === 'success' ? 'bg-green-100 text-green-600' : 'bg-blue-50 text-blue-600'}`}>
          {status === 'success' ? <Check size={40} /> : <Wifi size={40} className="rotate-90 animate-pulse" />}
        </div>
        <h3 className="text-xl font-bold mb-2 text-gray-900">Avvicina al Tag NFC</h3>
        <p className="text-gray-500 text-sm mb-6">Tocca il retro del dispositivo sul tag.</p>
        {status !== 'success' && <button onClick={simulateTouch} className="text-xs text-blue-500 font-bold underline">(SIMULA TOCCO)</button>}
      </div>
    </div>
  );
};

const BarcodeScanner = ({ onScan, onClose }) => {
  const videoRef = useRef(null);
  useEffect(() => {
    let stream = null;
    const start = async () => { try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }); if(videoRef.current) videoRef.current.srcObject = stream; setTimeout(() => onScan('12345'), 2500); } catch(e){} };
    start(); return () => { if(stream) stream.getTracks().forEach(t=>t.stop()); };
  }, []);
  return (
    <div className="fixed inset-0 z-[60] bg-black flex flex-col">
       <div className="absolute top-0 w-full p-4 flex justify-between z-10 text-white bg-gradient-to-b from-black/80 to-transparent"><span className="font-bold">SCANNER MATRICOLA</span><button onClick={onClose}><X size={20}/></button></div>
       <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover opacity-60" />
       <div className="absolute inset-0 flex items-center justify-center pointer-events-none"><div className="w-72 h-48 border-2 border-white/50 rounded-xl relative"><div className="w-full h-0.5 bg-red-500 absolute top-1/2 -translate-y-1/2 animate-pulse shadow-[0_0_10px_red]"></div></div></div>
    </div>
  );
};

// --- SCHERMATE DELL'APP ---

const LoginScreen = ({ onLogin }) => {
  const [matricola, setMatricola] = useState('');
  const [loading, setLoading] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [imgError, setImgError] = useState(false);
  
  const performLogin = async (code) => {
    if(!code) return;
    setLoading(true);
    const res = await apiFetchDriverName(code);
    setLoading(false);
    if(res.success) onLogin({ matricola: code, name: res.name });
    else alert('Matricola non trovata. Controlla il foglio "Autisti".');
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 relative p-6 overflow-hidden">
      {showScanner && <BarcodeScanner onScan={(c) => {setShowScanner(false); performLogin(c);}} onClose={() => setShowScanner(false)} />}
      <div className="absolute -top-20 -right-20 w-64 h-64 bg-blue-600 rounded-full blur-3xl opacity-20"></div>
      <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-black to-transparent z-0"></div>
      <div className="flex-1 flex flex-col justify-center z-10 relative">
        <div className="bg-white w-full max-w-[280px] h-32 mx-auto rounded-3xl flex items-center justify-center mb-10 shadow-2xl p-6">
          {!imgError ? <img src="https://www.camtrasportisrl.com/wp-content/uploads/2025/09/logo.png" className="w-full h-full object-contain" onError={()=>setImgError(true)}/> : <Truck className="text-blue-600 w-16 h-16"/>}
        </div>
        <h1 className="text-center text-5xl font-black text-white mb-2 tracking-tighter">Driver<span className="text-blue-500">Log</span></h1>
        <p className="text-center text-slate-400 mb-10 text-lg">Diario di bordo digitale</p>
        <div className="bg-white rounded-[2rem] p-2 shadow-xl">
          <div className="p-6">
            <button onClick={() => setShowScanner(true)} className="w-full bg-slate-900 text-white py-5 rounded-2xl font-bold flex items-center justify-center gap-3 mb-8 shadow-lg active:scale-95 transition-transform group">
               <div className="bg-white/10 p-2 rounded-lg"><Camera size={24} /></div><span className="text-lg">SCANSIONA BADGE</span>
            </button>
            <div className="relative mb-6 text-center border-t border-gray-100 pt-6"><span className="bg-white px-4 text-xs text-gray-400 font-bold uppercase -mt-9 block w-max mx-auto tracking-widest">Login Manuale</span></div>
            <div className="flex gap-2">
                <input className="w-full bg-gray-100 border-none rounded-xl p-4 font-bold text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="ID Matricola" value={matricola} onChange={(e) => setMatricola(e.target.value)} />
                <button onClick={() => performLogin(matricola)} disabled={loading} className="bg-blue-600 text-white px-6 rounded-xl font-bold hover:bg-blue-700 transition-colors disabled:opacity-50">{loading ? '...' : <Check />}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const StartShiftScreen = ({ user, onStart }) => {
  const [targa, setTarga] = useState('');
  const [km, setKm] = useState('');
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showNFC, setShowNFC] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showMyHistory, setShowMyHistory] = useState(false);
  const [kmWarningShown, setKmWarningShown] = useState(false);

  const loadVehicles = async () => {
      setLoading(true); setError(false);
      const data = await apiFetchVehicles();
      if (data && data.length > 0) {
          setVehicles(data);
      } else {
          setError(true);
      }
      setLoading(false);
  };

  useEffect(() => { loadVehicles(); }, []);

  const selectedVehicle = vehicles.find(v => v.targa === targa);

  const handleStartShift = () => {
    if(!targa || !km) return;
    const enteredKm = parseInt(km);
    let anomaly = false;

    if (selectedVehicle && selectedVehicle.lastKm && enteredKm < selectedVehicle.lastKm) {
        if (!kmWarningShown) {
            alert(`ATTENZIONE:\nI KM inseriti (${enteredKm}) sono inferiori all'ultima chiusura (${selectedVehicle.lastKm}).\n\nVerifica il contachilometri.\nSe sei sicuro, premi di nuovo "CONFERMA ANOMALIA" per registrare.`);
            setKmWarningShown(true);
            return;
        } else {
            anomaly = true;
        }
    }

    onStart({ 
        targa, 
        startKm: enteredKm, 
        startTime: new Date(), 
        fuelLogs: [], 
        anomaly: anomaly
    });
  };

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {showNFC && <NFCScanner onRead={(t) => {setTarga(t); setShowNFC(false);}} onCancel={() => setShowNFC(false)} />}
      
      {showHistory && <VehicleHistoryModal targa={targa} onClose={() => setShowHistory(false)} />}
      {showMyHistory && <DriverHistoryModal matricola={user.matricola} onClose={() => setShowMyHistory(false)} />}

      <div className="bg-white p-6 shadow-sm z-10 flex justify-between items-center border-b border-gray-100">
         <div><h2 className="text-xl font-bold text-gray-900">Benvenuto,</h2><p className="text-blue-600 font-bold">{user.name}</p></div>
         <div className="bg-gray-100 p-2 rounded-full"><User className="text-gray-500"/></div>
      </div>
      <div className="flex-1 p-6 overflow-y-auto">
        
        {/* Pulsante Storico Personale Aggiornato */}
        <button 
            onClick={() => setShowMyHistory(true)}
            className="w-full mb-6 py-3 bg-white rounded-xl border-2 border-gray-100 text-sm font-bold text-gray-600 flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors shadow-sm"
        >
            <Clock size={16} className="text-blue-500"/> Le mie ultime 14 registrazioni
        </button>

        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 mb-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-2 h-full bg-blue-500"></div>
          <div className="flex justify-between items-center mb-2">
             <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Seleziona Mezzo</label>
             <button onClick={() => setShowNFC(true)} className="flex items-center gap-1 text-[10px] font-bold bg-slate-900 text-white px-3 py-1.5 rounded-full hover:bg-slate-700 transition-colors"><Wifi size={12} className="rotate-90"/> USA NFC</button>
          </div>
          <div className="relative">
             {loading ? <div className="p-4 text-center text-gray-400 text-sm">Caricamento elenco mezzi...</div> : error ? <div className="p-4 bg-red-50 rounded-xl border border-red-100 text-red-600 text-sm flex flex-col items-center"><AlertTriangle className="mb-2"/><p className="font-bold">Impossibile caricare i mezzi.</p><button onClick={loadVehicles} className="flex items-center gap-2 bg-red-100 px-3 py-1 rounded-full text-xs font-bold hover:bg-red-200 mt-2"><RefreshCw size={12}/> Riprova</button></div> : <>
                <select value={targa} onChange={(e) => { setTarga(e.target.value); setKmWarningShown(false); }} className="w-full bg-gray-50 p-4 rounded-xl font-bold text-gray-800 appearance-none border-2 border-transparent focus:border-blue-500 outline-none">
                    <option value="">-- Scegli dalla lista --</option>
                    {vehicles.map((v, idx) => <option key={idx} value={v.targa}>{v.targa} - {v.modello}</option>)}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={20} />
             </>}
          </div>
        </div>

        {selectedVehicle && selectedVehicle.lastKm && (
          <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 mb-6 animate-in fade-in slide-in-from-top-2">
             <div className="flex justify-between items-center mb-3">
               <div>
                 <div className="flex items-center gap-1 mb-1"><History size={12} className="text-blue-500"/><p className="text-[10px] text-blue-500 font-bold uppercase tracking-wider">Ultima Chiusura</p></div>
                 <p className="text-2xl font-mono font-bold text-blue-900">{selectedVehicle.lastKm}</p>
                 {selectedVehicle.lastDriver && <p className="text-[10px] text-blue-400">Driver: {selectedVehicle.lastDriver}</p>}
               </div>
               <button onClick={() => { setKm(selectedVehicle.lastKm); setKmWarningShown(false); }} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-blue-200 shadow-lg hover:bg-blue-700 active:scale-95 transition-all">USA QUESTO</button>
             </div>
             <button onClick={() => setShowHistory(true)} className="w-full py-2 bg-white rounded-lg border border-blue-100 text-xs font-bold text-blue-600 flex items-center justify-center gap-2 hover:bg-blue-50 transition-colors"><Users size={14}/> Vedi ultimi 5 utilizzatori</button>
          </div>
        )}

        <div className={`bg-white p-6 rounded-3xl shadow-sm border ${kmWarningShown ? 'border-red-500 ring-2 ring-red-100' : 'border-gray-100'}`}>
          <label className={`text-xs font-bold uppercase tracking-wider mb-2 block ${kmWarningShown ? 'text-red-500' : 'text-gray-400'}`}>
             {kmWarningShown ? 'CONFERMA KM (ANOMALIA RILEVATA)' : 'KM INIZIALI'}
          </label>
          <div className="flex items-center gap-2">
             <input type="number" value={km} onChange={(e) => { setKm(e.target.value); setKmWarningShown(false); }} placeholder="000000" className={`w-full text-3xl font-mono font-bold placeholder-gray-200 outline-none ${kmWarningShown ? 'text-red-600' : 'text-gray-800'}`}/>
             <span className="text-gray-400 font-bold text-sm">KM</span>
          </div>
          {kmWarningShown && <p className="text-xs text-red-500 mt-2 font-bold animate-pulse">⚠ I KM sono inferiori allo storico. Premi CONFERMA per registrare.</p>}
        </div>
      </div>
      <div className="p-6 bg-white border-t border-gray-100 pb-8">
          <Button onClick={handleStartShift} icon={Navigation} disabled={!targa || !km} variant={kmWarningShown ? 'danger' : 'primary'}>
              {kmWarningShown ? 'CONFERMA ANOMALIA' : 'INIZIA SERVIZIO'}
          </Button>
      </div>
    </div>
  );
};

const ActiveShiftScreen = ({ session, onEndShift, onAddFuel, onSessionUpdate }) => {
  const [time, setTime] = useState("");
  const [showFuelModal, setShowFuelModal] = useState(false);
  const [lastCheck, setLastCheck] = useState(Date.now());

  // --- POLLING SINCRONIZZAZIONE ---
  useEffect(() => {
    const timer = setInterval(() => {
        const update = () => {
            const diff = new Date() - new Date(session.startTime);
            const h = Math.floor(diff/3600000).toString().padStart(2,'0');
            const m = Math.floor((diff%3600000)/60000).toString().padStart(2,'0');
            const s = Math.floor((diff%60000)/1000).toString().padStart(2,'0');
            setTime(`${h}:${m}:${s}`);
        };
        update();
    }, 1000);

    // Sync con DB ogni 15 secondi per correzioni Ufficio
    const syncTimer = setInterval(async () => {
        const res = await apiCheckRemoteUpdates(session.user.name);
        
        if (res.found) {
            const updates = {};
            let hasUpdate = false;

            // Controllo aggiornamento KM
            if (res.startKm && res.startKm !== session.startKm) {
                updates.startKm = res.startKm;
                hasUpdate = true;
            }

            // Controllo aggiornamento TARGA
            if (res.targa && res.targa !== session.targa) {
                updates.targa = res.targa;
                hasUpdate = true;
            }

            if (hasUpdate) {
                onSessionUpdate(updates);
            }
        }
    }, 15000);

    return () => { clearInterval(timer); clearInterval(syncTimer); };
  }, [session]); // Dipendenza session per avere sempre i dati aggiornati

  const handleFuelSave = async (data) => { 
    await apiLogFuel(session, data);
    onAddFuel(data); 
  };

  return (
    <div className="h-full flex flex-col bg-slate-50">
       {showFuelModal && <RefuelingModal onClose={() => setShowFuelModal(false)} onSave={handleFuelSave} />}
       <div className="bg-slate-900 text-white p-8 rounded-b-[3rem] shadow-2xl relative z-10 overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500 rounded-full blur-[80px] opacity-20 pointer-events-none"></div>
          <div className="relative z-10">
            <div className="flex justify-between items-start mb-8">
               <div className="bg-white/10 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest text-green-400 border border-green-500/30 flex items-center gap-2 w-max"><span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span> Turno Attivo</div>
               <div className="text-right"><p className="text-[10px] text-slate-400 uppercase font-bold">Autista</p><p className="font-bold">{session.user.name}</p></div>
            </div>
            <h2 className="text-4xl font-black mb-1">{session.targa}</h2>
            {/* Indicatore Sync Attivo */}
            <div className="flex items-center gap-2 mb-2">
                {session.anomaly && <div className="inline-flex items-center gap-1 bg-red-500/20 text-red-300 px-2 py-1 rounded text-[10px] font-bold border border-red-500/50"><AlertOctagon size={12}/> ANOMALIA KM</div>}
                <div className="inline-flex items-center gap-1 bg-blue-500/20 text-blue-300 px-2 py-1 rounded text-[10px] font-bold border border-blue-500/50"><RefreshCw size={12} className="animate-spin-slow"/> SYNC</div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-4">
               <div className="bg-black/20 p-3 rounded-xl backdrop-blur-sm border border-white/5"><p className="text-[10px] text-slate-400 uppercase font-bold">Partenza</p><p className={`text-xl font-mono ${session.anomaly ? 'text-red-400' : ''}`}>{session.startKm} <span className="text-xs text-slate-500">km</span></p></div>
               <div className="bg-black/20 p-3 rounded-xl backdrop-blur-sm border border-white/5"><p className="text-[10px] text-slate-400 uppercase font-bold">Tempo</p><p className="text-xl font-mono">{time}</p></div>
            </div>
          </div>
       </div>
       <div className="flex-1 flex flex-col justify-between p-6">
          <div className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100 flex-1 mb-4 flex flex-col items-center justify-center">
             <div className="text-center w-full">
                {session.fuelLogs && session.fuelLogs.length > 0 ? (
                  <div className="mb-6 bg-orange-50 p-4 rounded-xl border border-orange-100 w-full animate-in fade-in"><p className="text-orange-800 font-bold flex items-center justify-center gap-2 mb-1"><Check size={16}/> Rifornimento OK</p><p className="text-xs text-orange-600">Ultimo: {session.fuelLogs[session.fuelLogs.length - 1].litri}L</p></div>
                ) : <p className="text-gray-400 text-sm mb-6">Nessun rifornimento registrato</p>}
                <Button onClick={() => setShowFuelModal(true)} variant="warning" icon={Fuel} className="mb-4">Registra Rifornimento</Button>
             </div>
          </div>
          <Button onClick={onEndShift} variant="danger" icon={LogOut} className="shadow-lg shadow-red-200">TERMINA TURNO</Button>
       </div>
    </div>
  );
};

const EndShiftScreen = ({ session, onSave, onCancel, onSessionUpdate }) => {
  const [step, setStep] = useState('INPUT');
  const [endKm, setEndKm] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const totalKm = endKm ? parseInt(endKm) - session.startKm : 0;
  const totalFuelCost = session.fuelLogs ? session.fuelLogs.reduce((acc, curr) => acc + parseFloat(curr.importo), 0) : 0;
  const totalLiters = session.fuelLogs ? session.fuelLogs.reduce((acc, curr) => acc + parseFloat(curr.litri), 0) : 0;

  // SYNC AGGIUNTO ANCHE IN END SHIFT (per rilevare correzioni mentre l'autista è fermo qui)
  useEffect(() => {
    const syncTimer = setInterval(async () => {
        const res = await apiCheckRemoteUpdates(session.user.name);
        
        if (res.found) {
            const updates = {};
            let hasUpdate = false;

            if (res.startKm && res.startKm !== session.startKm) {
                updates.startKm = res.startKm;
                hasUpdate = true;
            }
            if (res.targa && res.targa !== session.targa) {
                updates.targa = res.targa;
                hasUpdate = true;
            }

            if (hasUpdate) {
                onSessionUpdate(updates);
            }
        }
    }, 5000); // Sync più frequente qui (ogni 5 sec) per non bloccare l'autista

    return () => clearInterval(syncTimer);
  }, [session]);

  const handleGoToSummary = () => {
    if (!endKm) return alert("Inserisci i KM finali.");
    // Non blocchiamo se i km finali sono minori, ma avvisiamo. (Potrebbe essere un giro del contachilometri o errore)
    if (parseInt(endKm) < session.startKm) {
        const confirm = window.confirm(`ATTENZIONE: I KM finali (${endKm}) sono minori di quelli iniziali (${session.startKm}). Sei sicuro?`);
        if(!confirm) return;
    }
    setStep('SUMMARY');
  };

  const handleSave = async () => {
    setIsSaving(true);
    await apiSaveLog({ 
        driver: session.user.matricola, 
        driverName: session.user.name, 
        targa: session.targa, 
        start: session.startKm, 
        end: endKm, 
        totalKm: totalKm, 
        fuelOperations: session.fuelLogs,
        anomaly: session.anomaly 
    });
    setIsSaving(false); setSaved(true); setTimeout(onSave, 2500);
  };

  if (saved) return <div className="h-full bg-emerald-600 text-white flex flex-col items-center justify-center"><div className="bg-white p-6 rounded-full shadow-lg mb-6 animate-bounce"><Check size={48} className="text-emerald-600"/></div><h2 className="text-3xl font-bold mb-2">Dati Salvati!</h2></div>;

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="bg-white p-6 shadow-sm border-b border-gray-100 flex items-center justify-between"><div><h2 className="text-xl font-bold text-gray-900">{step === 'INPUT' ? 'Chiusura Turno' : 'Riepilogo'}</h2></div>{step === 'SUMMARY' && <div className="bg-blue-50 text-blue-600 p-2 rounded-lg font-bold text-xs uppercase">Step 2/2</div>}</div>
      <div className="flex-1 p-6 overflow-y-auto">
        {step === 'INPUT' && (
            <div className="bg-white p-8 rounded-3xl shadow-lg border border-gray-100 mb-6 text-center animate-in fade-in slide-in-from-bottom-8">
                <p className="text-sm text-gray-400 font-bold uppercase tracking-widest mb-6">Inserisci KM Finali</p>
                <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 mb-8 inline-block w-full">
                    <p className="text-xs text-blue-600 font-bold uppercase mb-1">Partenza</p>
                    <p className={`text-3xl font-mono font-black ${session.anomaly ? 'text-red-500' : 'text-blue-900'}`}>{session.startKm}</p>
                    {session.anomaly && <p className="text-[10px] text-red-500 font-bold mt-1 animate-pulse">ANOMALIA START</p>}
                </div>
                <input type="number" value={endKm} onChange={(e)=>setEndKm(e.target.value)} placeholder="000000" autoFocus className="w-full text-center text-4xl font-bold text-gray-800 border-b-4 border-gray-200 focus:border-blue-500 outline-none pb-2 bg-transparent"/>
            </div>
        )}
        {step === 'SUMMARY' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-8">
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex items-center gap-4">
                    <div className="bg-slate-100 p-3 rounded-2xl text-slate-600"><Truck size={24} /></div>
                    <div><p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Veicolo</p><p className="text-2xl font-black text-slate-800">{session.targa}</p></div>
                </div>
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                    <div className="grid grid-cols-2 gap-8 mb-6"><div><p className="text-[10px] text-gray-400 uppercase font-bold">Inizio</p><p className={`font-mono font-bold text-xl ${session.anomaly ? 'text-red-500' : ''}`}>{session.startKm}</p></div><div className="text-right"><p className="text-[10px] text-gray-400 uppercase font-bold">Fine</p><p className="font-mono font-bold text-xl">{endKm}</p></div></div>
                    <div className="bg-gray-50 p-4 rounded-2xl flex justify-between items-center"><span className="text-sm font-bold text-gray-500 uppercase">Totale</span><span className="text-2xl font-black text-blue-600">{totalKm} km</span></div>
                </div>
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                    <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Droplet className="text-orange-500" size={18}/> Carburante</h3>
                    {session.fuelLogs.length > 0 ? <div className="flex gap-3"><div className="flex-1 bg-orange-50 p-3 rounded-2xl text-center"><p className="text-[10px] text-orange-400 font-bold uppercase">Litri</p><p className="font-bold text-orange-900 text-lg">{totalLiters}</p></div><div className="flex-1 bg-orange-50 p-3 rounded-2xl text-center"><p className="text-[10px] text-orange-400 font-bold uppercase">Spesa</p><p className="font-bold text-orange-900 text-lg">€ {totalFuelCost}</p></div></div> : <p className="text-sm text-gray-400 text-center">Nessun rifornimento.</p>}
                </div>
            </div>
        )}
      </div>
      <div className="p-6 bg-white border-t border-gray-100 flex gap-4 pb-8">
        {step === 'INPUT' ? <><button onClick={onCancel} className="font-bold text-gray-400 px-4">Annulla</button><Button onClick={handleGoToSummary} icon={ArrowRight}>Avanti</Button></> : <><button onClick={() => setStep('INPUT')} className="font-bold text-gray-400 px-4">Indietro</button><Button onClick={handleSave} disabled={isSaving} variant="success" icon={Check}>{isSaving ? 'Salvataggio...' : 'Conferma'}</Button></>}
      </div>
    </div>
  );
};

// --- MAIN ---

export default function App() {
  const [user, setUser] = useState(null);
  const [activeSession, setActiveSession] = useState(null);
  const [view, setView] = useState('LOGIN');
  const [allSessions, setAllSessions] = useState({});

  useEffect(() => { const s = localStorage.getItem('driver_sessions_v11'); if(s) setAllSessions(JSON.parse(s)); }, []);
  const saveSessions = (s) => { setAllSessions(s); localStorage.setItem('driver_sessions_v11', JSON.stringify(s)); };

  const handleLogin = (u) => {
    setUser(u);
    const existing = allSessions[u.matricola];
    if (existing) { setActiveSession({...existing, startTime: new Date(existing.startTime), user: u}); setView('ACTIVE'); }
    else setView('START');
  };

  // Funzione per aggiornare la sessione (usata per il SYNC dei KM)
  const handleSessionUpdate = (updates) => {
    if (!activeSession) return;
    
    // Se l'ufficio corregge i KM, rimuoviamo l'anomalia
    let resolvedAnomaly = activeSession.anomaly;
    if (updates.startKm) {
        resolvedAnomaly = false;
    }

    const updated = { ...activeSession, ...updates, anomaly: resolvedAnomaly };
    setActiveSession(updated);
    saveSessions({ ...allSessions, [user.matricola]: updated });
    
    if (updates.startKm) alert(`⚠️ AGGIORNAMENTO UFFICIO ⚠️\nIl valore dei KM Iniziali è stato corretto in: ${updates.startKm}.\nL'anomalia è stata rimossa.`);
    if (updates.targa) alert(`⚠️ AGGIORNAMENTO UFFICIO ⚠️\nLa targa è stata corretta in: ${updates.targa}.`);
  };

  const handleStart = (data) => {
    const sessionId = Date.now().toString(36) + Math.random().toString(36).substr(2);
    const s = { ...data, user, fuelLogs: [], sessionId };
    
    setActiveSession(s); 
    setView('ACTIVE'); 
    saveSessions({ ...allSessions, [user.matricola]: s });

    apiStartShift(s);
  };

  const handleFuel = (f) => {
    const s = { ...activeSession, fuelLogs: [...(activeSession.fuelLogs || []), f] };
    setActiveSession(s); saveSessions({ ...allSessions, [user.matricola]: s });
  };

  const handleComplete = () => {
    setActiveSession(null);
    const updated = { ...allSessions }; delete updated[user.matricola]; saveSessions(updated);
    setUser(null); setView('LOGIN');
  };

  const handleLogout = () => { setUser(null); setActiveSession(null); setView('LOGIN'); };

  return (
    <div className="w-full max-w-md mx-auto h-screen bg-white shadow-2xl overflow-hidden font-sans text-gray-900 relative">
      {view !== 'LOGIN' && <button onClick={handleLogout} className="absolute top-4 right-4 z-50 p-2 bg-white/90 backdrop-blur rounded-full shadow-sm text-slate-400"><LogOut size={18}/></button>}
      {view === 'LOGIN' && <LoginScreen onLogin={handleLogin} />}
      {view === 'START' && <StartShiftScreen user={user} onStart={handleStart} />}
      {view === 'ACTIVE' && <ActiveShiftScreen session={activeSession} onEndShift={() => setView('END')} onAddFuel={handleFuel} onSessionUpdate={handleSessionUpdate} />}
      {view === 'END' && <EndShiftScreen session={activeSession} onSave={handleComplete} onCancel={() => setView('ACTIVE')} onSessionUpdate={handleSessionUpdate} />}
    </div>
  );
}