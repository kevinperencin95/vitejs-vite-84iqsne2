import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
// Importazioni Firebase/Firestore (Necessarie per l'architettura Canvas/Backend)
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, collection, query, where } from 'firebase/firestore';
import { setLogLevel } from 'firebase/firestore';
import { QrCode, LogOut, Clock, Truck, Fuel, Zap, Calendar, MapPin, CheckCircle, AlertTriangle, X, Users, History, RefreshCw, ChevronDown, Check as CheckIcon } from 'lucide-react';

// Lo scanner react-zxing è stato Rimosso e Sostituito da una SIMULAZIONE per la compilazione.

// Variabili globali fornite dall'ambiente Canvas (obbligatorie per Firestore)
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Configurazione Iniziale e Variabili Globali per l'API (Sostituire con il tuo script Google Sheets reale)
// NOTA: Questa è la tua API URL. Assicurati che sia corretta e pubblica.
const API_URL = "https://script.google.com/macros/s/AKfycby7bUaI4XQnE_2t/exec"; 

// -----------------------------------------------------------------------------
// Componenti di Utilità e API Fittizie (Devi implementare il fetch per l'API_URL)
// -----------------------------------------------------------------------------

// Funzione di formattazione della data per il foglio Google Sheets (es. YYYY-MM-DD)
const formatDate = (date) => date.toISOString().split('T')[0];
const formatTime = (date) => date.toTimeString().split(' ')[0].substring(0, 5);

// SIMULAZIONE API (Devono essere sostituite con chiamate fetch reali al tuo script Google Apps)
const checkOfficePreload = async (employeeId) => {
    try {
        // --- INIZIO SIMULAZIONE DI RISPOSTA REALE DA GOOGLE SHEETS ---
        // Se la matricola è '999', simuliamo un pre-carico dall'ufficio
        if (employeeId === '999') {
             return { 
                found: true, 
                kmStart: 124578, // KM pre-caricati
                vehicleId: 'VEH_999'
             };
        }
        // --- FINE SIMULAZIONE ---

        // In una vera app, la logica sarebbe:
        // const response = await fetch(`${API_URL}?action=checkPreload&matricola=${employeeId}`);
        // const data = await response.json();
        // if (data.found && data.kmStart > 0) return data;

        return null;
    } catch (e) {
        console.error("Errore nella verifica del pre-carico ufficio:", e);
        return null;
    }
};

const apiFetchDriversList = async () => {
  // Funzione per caricare i nomi degli autisti (non implementata in questa versione semplificata)
  return [{ matricola: '12345', name: 'Mario Rossi' }, { matricola: '999', name: 'Autista Pre-carico' }];
};


// -----------------------------------------------------------------------------
// Componente Scanner QR/Barcode (SIMULAZIONE HTML5)
// -----------------------------------------------------------------------------
const BarcodeScanner = ({ onScan }) => {
  const videoRef = useRef(null);

  useEffect(() => {
    let stream = null;
    const startCamera = async () => {
      try {
        // Tenta di avviare la fotocamera per l'anteprima
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (videoRef.current) videoRef.current.srcObject = stream;

        // SIMULAZIONE RILEVAMENTO: Chiusura automatica e simulazione lettura "12345"
        setTimeout(() => {
           if (navigator.vibrate) navigator.vibrate(200);
           onScan('12345'); // Simula la lettura della matricola
        }, 3000);
      } catch (err) {
        console.error("Camera Error", err);
      }
    };
    startCamera();
    // Funzione di pulizia: spegne la fotocamera quando il componente scompare
    return () => { if (stream) stream.getTracks().forEach(track => track.stop()); };
  }, []);

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="absolute top-4 right-4 z-10">
         <button onClick={() => onScan(null)} className="p-3 rounded-full bg-white text-red-500 shadow-lg">
            <X className="w-6 h-6" />
         </button>
      </div>
      <div className="relative w-full h-full max-w-lg max-h-lg">
          <video ref={videoRef} className="w-full h-full object-cover rounded-xl" />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
             <div className="w-80 h-48 border-2 border-green-500 rounded-xl relative shadow-[0_0_0_9999px_rgba(0,0,0,0.6)]">
                <div className="w-full h-0.5 bg-green-500 absolute top-1/2 -translate-y-1/2 animate-pulse shadow-[0_0_20px_green]"></div>
             </div>
          </div>
          <p className="absolute bottom-10 left-1/2 transform -translate-x-1/2 text-white/90 text-sm font-medium bg-black/60 px-4 py-2 rounded-full">
             Inquadra la Matricola (Simulazione lettura tra 3 secondi)
          </p>
      </div>
    </div>
  );
};


// -----------------------------------------------------------------------------
// Componente Principale
// -----------------------------------------------------------------------------

const App = () => {
  // Stati di autenticazione e Firebase
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [userId, setUserId] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [matricola, setMatricola] = useState('');

  // Stati dell'Applicazione
  const [screen, setScreen] = useState('LOGIN');
  const [loading, setLoading] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Stato del turno corrente
  const [currentShift, setCurrentShift] = useState({
    date: formatDate(new Date()),
    isStarted: false,
    kmStart: 0,
    kmEnd: 0,
    vehicleId: '',
    fuelRecords: [],
    isPreloaded: false, 
    driverName: '' // Aggiunto per consistenza
  });

  const today = useMemo(() => formatDate(new Date()), []);
  
  // Riferimento al documento Firestore basato su Utente e Data (usato per persistenza)
  const shiftDocRef = useMemo(() => 
    db && matricola
      ? doc(db, 'artifacts', appId, 'users', matricola, 'shifts', today) 
      : null,
    [db, matricola, today]
  );

  // --- Inizializzazione Firebase ---
  useEffect(() => {
    try {
      setLogLevel('debug');
      const app = initializeApp(firebaseConfig);
      const dbInstance = getFirestore(app);
      const authInstance = getAuth(app);

      setDb(dbInstance);
      setAuth(authInstance);

      const unsubscribe = onAuthStateChanged(authInstance, async (user) => {
        if (user) { setUserId(user.uid); } 
        else {
          try {
            if (initialAuthToken) { await signInWithCustomToken(authInstance, initialAuthToken); } 
            else { await signInAnonymously(authInstance); }
          } catch (e) { setError("Errore di autenticazione."); }
        }
        setIsAuthReady(true);
      });

      return () => unsubscribe();
    } catch (e) { setError("Impossibile connettersi al database."); }
  }, []);

  // --- Listener Firestore per persistenza locale ---
  useEffect(() => {
    if (!db || !isAuthReady || !matricola || !shiftDocRef) return;
    
    const unsubscribe = onSnapshot(shiftDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.isStarted) {
          setCurrentShift(prev => ({
            ...prev,
            ...data,
            isStarted: true,
          }));
          setScreen('IN_SERVICE');
        }
      } 
    }, (error) => { console.error("Errore nel listener Firestore:", error); });

    return () => unsubscribe();
  }, [db, isAuthReady, matricola, shiftDocRef]);


  // -----------------------------------------------------------------------------
  // Logica di Login e Reindirizzamento (INCLUSA FUNZIONE DI PRE-CARICO)
  // -----------------------------------------------------------------------------
  const handleLogin = useCallback(async (id, vehicleId, preloadedName = null) => {
    if (!db || !auth || !id) return;

    setMatricola(id);
    setLoading(true);

    try {
      // 1. Verifica Nome Autista (Simulazione)
      const nomeAutista = preloadedName || `Autista-${id}`;
      
      // 2. Controlla se l'ufficio ha già inserito i KM Iniziali (Logica Reale)
      const preloadData = await checkOfficePreload(id);
      const docRef = doc(db, 'artifacts', appId, 'users', id, 'shifts', today);


      if (preloadData) {
        // CASO 1: KM INIZIALI PRE-CARICATI DALL'UFFICIO
        const newShift = {
          date: today,
          isStarted: true,
          kmStart: preloadData.kmStart,
          kmEnd: 0,
          vehicleId: preloadData.vehicleId, 
          driverName: nomeAutista,
          fuelRecords: [],
          isPreloaded: true, // Flag per indicare che è stato saltato il passo iniziale
          startTime: formatTime(new Date()),
        };

        await setDoc(docRef, newShift);
        setCurrentShift(newShift);
        setScreen('IN_SERVICE');
        setSuccess(`Turno pre-caricato (${preloadData.kmStart} KM). Benvenuto!`);

      } else {
        // CASO 2: NESSUN KM INIZIALE - Procedi con la normale apertura turno
        setCurrentShift(prev => ({ ...prev, vehicleId: vehicleId, driverName: nomeAutista }));
        setScreen('START_SHIFT');
      }

    } catch (e) {
      setError("Errore durante il login/verifica turno. Riprova.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [db, auth, today]);


  // Funzione per avviare il turno (solo se non pre-caricato)
  const startShift = useCallback(async (kmStart, vehicleId) => {
    const docRef = doc(db, 'artifacts', appId, 'users', matricola, 'shifts', today);
    if (!docRef || loading) return;

    const newShift = {
      date: today,
      isStarted: true,
      kmStart: kmStart,
      kmEnd: 0,
      vehicleId: vehicleId,
      driverName: currentShift.driverName,
      fuelRecords: [],
      isPreloaded: false,
      startTime: formatTime(new Date()),
    };

    setLoading(true);
    try {
      await setDoc(docRef, newShift);
      setCurrentShift(newShift);
      setScreen('IN_SERVICE');
      setSuccess("Turno avviato con successo!");
    } catch (e) {
      setError("Errore nel salvataggio del turno.");
    } finally {
      setLoading(false);
    }
  }, [db, matricola, today, loading, currentShift.driverName]);
  
  // Funzione per aggiungere il rifornimento
  const addFuel = useCallback(async (km, amount) => {
    const docRef = doc(db, 'artifacts', appId, 'users', matricola, 'shifts', today);
    if (!docRef || loading || !currentShift.isStarted) return;
    
    const newFuel = { km: km, amount: amount, time: formatTime(new Date()), timestamp: Date.now() };
    const updatedFuelRecords = [...currentShift.fuelRecords, newFuel];

    setLoading(true);
    try {
      await setDoc(docRef, { fuelRecords: updatedFuelRecords }, { merge: true });
      setCurrentShift(prev => ({ ...prev, fuelRecords: updatedFuelRecords }));
      setSuccess("Rifornimento registrato!");
    } catch (e) {
      setError("Errore nel salvataggio del rifornimento.");
    } finally {
      setLoading(false);
    }
  }, [db, matricola, today, loading, currentShift]);


  // Funzione per concludere il turno
  const endShift = useCallback(async (kmEnd) => {
    const docRef = doc(db, 'artifacts', appId, 'users', matricola, 'shifts', today);
    if (!docRef || loading || !currentShift.isStarted) return;
    
    const updatedShift = {
      ...currentShift,
      kmEnd: kmEnd,
      endTime: formatTime(new Date()),
      isStarted: false,
    };

    setLoading(true);
    try {
      await setDoc(docRef, updatedShift, { merge: true });
      setCurrentShift(updatedShift);
      setScreen('END_SHIFT');
      setSuccess("Turno concluso con successo!");
    } catch (e) {
      setError("Errore nella conclusione del turno.");
    } finally {
      setLoading(false);
    }
  }, [db, matricola, today, loading, currentShift]);

  // Gestione messaggi (successo/errore)
  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError(null);
        setSuccess(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, success]);
  
  // Logout Semplificato
  const handleLogout = useCallback(() => {
    setMatricola('');
    setCurrentShift({
      date: formatDate(new Date()),
      isStarted: false,
      kmStart: 0,
      kmEnd: 0,
      vehicleId: '',
      fuelRecords: [],
      isPreloaded: false,
      driverName: ''
    });
    setScreen('LOGIN');
  }, []);

  // --- Componenti di Schermo (Render) ---

  const LoginScreen = () => {
    const [inputMatricola, setInputMatricola] = useState('');
    const [inputVehicleId, setInputVehicleId] = useState('');
    const [selectedMatricola, setSelectedMatricola] = useState('');
    const [driversList, setDriversList] = useState([]);

    useEffect(() => {
        apiFetchDriversList().then(setDriversList);
    }, []);

    const submitLogin = (matricolaToUse, vehicleIdToUse) => {
      // Trova il nome autista per passarlo al pre-carico
      const selectedDriver = driversList.find(d => d.matricola === matricolaToUse);
      const name = selectedDriver ? selectedDriver.name : null;
      
      if (matricolaToUse && vehicleIdToUse) {
        handleLogin(matricolaToUse, vehicleIdToUse, name);
      } else {
        setError("Matricola e ID Veicolo sono obbligatori.");
      }
    };

    const handleScanResult = (result) => {
      setScannerOpen(false);
      if (result) {
        setInputMatricola(result);
        setError("Matricola " + result + " scansionata. Inserisci ID Veicolo per accedere.");
      }
    };
    
    const handleSelectChange = (e) => {
        const matricola = e.target.value;
        const selectedDriver = driversList.find(d => d.matricola === matricola);
        if (selectedDriver) {
            setSelectedMatricola(matricola);
            setInputMatricola(matricola); 
        } else {
            setSelectedMatricola('');
            setInputMatricola('');
        }
    };

    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
        <Truck className="w-16 h-16 text-indigo-600 mb-6" />
        <h1 className="text-3xl font-bold text-gray-800 mb-8">Login Autista</h1>
        
        <div className="w-full max-w-md bg-white p-6 rounded-xl shadow-lg">
          <p className="text-sm text-gray-500 mb-4">ID Utente di sessione: <span className="font-mono text-xs">{userId || 'N/D'}</span></p>

          <div className="relative mb-4">
              <select 
                  onChange={handleSelectChange}
                  value={selectedMatricola}
                  className="w-full p-3 border border-gray-300 rounded-lg appearance-none bg-gray-50 font-semibold text-gray-700"
              >
                  <option value="">-- Seleziona il tuo Nome (Matricola) --</option>
                  {driversList.map(d => (
                      <option key={d.matricola} value={d.matricola}>{d.name} ({d.matricola})</option>
                  ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
          </div>

          <input
            type="text"
            placeholder="Matricola Autista (Manuale)"
            value={inputMatricola}
            onChange={(e) => { setInputMatricola(e.target.value); setSelectedMatricola(''); }}
            className="w-full p-3 mb-4 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
          />
          <input
            type="text"
            placeholder="ID Veicolo (Necessario per iniziare)"
            value={inputVehicleId}
            onChange={(e) => setInputVehicleId(e.target.value)}
            className="w-full p-3 mb-4 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
          />

          <button
            onClick={() => submitLogin(inputMatricola, inputVehicleId)}
            disabled={loading || !inputMatricola || !inputVehicleId}
            className="w-full py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition duration-150 shadow-md disabled:bg-indigo-400"
          >
            {loading ? 'Verifica Turno...' : 'Accedi'}
          </button>

          <button
            onClick={() => setScannerOpen(true)}
            className="mt-4 w-full py-3 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition duration-150 shadow-sm flex items-center justify-center"
          >
            <QrCode className="w-5 h-5 mr-2" /> Scansiona Codice
          </button>
        </div>
        {scannerOpen && <BarcodeScanner onScan={handleScanResult} />}
      </div>
    );
  };


  const StartShiftScreen = () => {
    const [kmStartInput, setKmStartInput] = useState('');
    
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
        <h1 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
          <Clock className="w-6 h-6 mr-2 text-red-500" /> Avvia Turno
        </h1>
        <div className="w-full max-w-md bg-white p-6 rounded-xl shadow-lg">
          <p className="text-sm text-gray-600 mb-4">Matricola: **{matricola}** | Veicolo: **{currentShift.vehicleId}**</p>
          <p className="text-sm text-red-500 mb-6">Attenzione: Inserisci i KM attuali del veicolo.</p>

          <input
            type="number"
            placeholder="KM Iniziali (Contachilometri)"
            value={kmStartInput}
            onChange={(e) => setKmStartInput(e.target.value)}
            className="w-full p-3 mb-6 border border-red-300 rounded-lg focus:ring-red-500 focus:border-red-500"
          />

          <button
            onClick={() => startShift(parseInt(kmStartInput, 10), currentShift.vehicleId)}
            disabled={loading || !kmStartInput || parseInt(kmStartInput, 10) === 0}
            className="w-full py-3 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition duration-150 shadow-md disabled:bg-red-400"
          >
            {loading ? 'Avvio...' : 'Registra KM e Inizia Servizio'}
          </button>
          
          <button onClick={handleLogout} className="mt-4 w-full py-2 text-gray-500 hover:text-red-500 transition duration-150">
            <LogOut className="w-4 h-4 mr-2 inline" /> Esci
          </button>
        </div>
      </div>
    );
  };
  
  const InServiceScreen = () => {
    const [fuelKm, setFuelKm] = useState('');
    const [fuelAmount, setFuelAmount] = useState('');

    const totalFuel = currentShift.fuelRecords.reduce((acc, curr) => acc + curr.amount, 0);
    
    // Messaggio specifico per il pre-carico
    const preloadMessage = currentShift.isPreloaded ? (
        <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-3 mb-4 rounded-lg flex items-center">
            <AlertTriangle className="w-5 h-5 mr-2" />
            <p className="text-sm">I KM Iniziali sono stati pre-caricati dall'ufficio. Procedi con il servizio.</p>
        </div>
    ) : null;

    return (
      <div className="min-h-screen bg-gray-100 p-4">
        <div className="max-w-xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-800 pt-6 flex justify-between items-center">
             Turno Attivo <Clock className="w-6 h-6 text-green-600" />
          </h1>
          <p className="text-sm text-gray-500 mb-6">Matricola: {matricola} | Veicolo: {currentShift.vehicleId} | Data: {currentShift.date}</p>
          
          {preloadMessage}

          {/* Dettagli Turno */}
          <div className="bg-white p-5 rounded-xl shadow-md mb-6">
            <div className="flex justify-between items-center mb-3 border-b pb-2">
              <span className="font-semibold text-gray-700 flex items-center"><MapPin className="w-4 h-4 mr-2" /> KM Inizio</span>
              <span className="text-xl font-extrabold text-indigo-600">{currentShift.kmStart}</span>
            </div>
            <div className="flex justify-between items-center mb-3">
              <span className="font-semibold text-gray-700 flex items-center"><Fuel className="w-4 h-4 mr-2" /> Litri Riforniti</span>
              <span className="text-xl font-extrabold text-green-600">{totalFuel} L</span>
            </div>
            <div className="text-xs text-gray-400 mt-2">Inizio Turno: {currentShift.startTime}</div>
          </div>

          {/* Registra Rifornimento */}
          <div className="bg-white p-5 rounded-xl shadow-md mb-6 border-2 border-blue-200">
            <h2 className="text-xl font-bold mb-4 text-blue-600 flex items-center"><Fuel className="w-5 h-5 mr-2" /> Nuovo Rifornimento</h2>
            <input
              type="number"
              placeholder="KM Attuali (al Rifornimento)"
              value={fuelKm}
              onChange={(e) => setFuelKm(e.target.value)}
              className="w-full p-3 mb-3 border border-gray-300 rounded-lg"
            />
            <input
              type="number"
              placeholder="Litri Riforniti"
              value={fuelAmount}
              onChange={(e) => setFuelAmount(e.target.value)}
              className="w-full p-3 mb-4 border border-gray-300 rounded-lg"
            />
            <button
              onClick={() => addFuel(parseInt(fuelKm, 10), parseFloat(fuelAmount))}
              disabled={loading || !fuelKm || !fuelAmount || parseInt(fuelKm, 10) <= currentShift.kmStart}
              className="w-full py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition duration-150 disabled:bg-blue-300"
            >
              {loading ? 'Salvataggio...' : 'Registra Rifornimento'}
            </button>
          </div>

          {/* Concludi Turno */}
          <div className="bg-white p-5 rounded-xl shadow-md mb-6 border-2 border-red-200">
            <h2 className="text-xl font-bold mb-4 text-red-600 flex items-center"><LogOut className="w-5 h-5 mr-2" /> Concludi Turno</h2>
            <input
              type="number"
              placeholder="KM Finali (Contachilometri)"
              value={endKmInput}
              onChange={(e) => setEndKmInput(e.target.value)}
              className="w-full p-3 mb-4 border border-gray-300 rounded-lg"
            />
            <button
              onClick={() => endShift(parseInt(endKmInput, 10))}
              disabled={loading || !endKmInput || parseInt(endKmInput, 10) < currentShift.kmStart}
              className="w-full py-3 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition duration-150 disabled:bg-red-300"
            >
              {loading ? 'Conclusione...' : 'Registra KM Finali e Termina Turno'}
            </button>
          </div>
          
          <button onClick={handleLogout} className="mt-4 mb-8 w-full py-2 text-gray-500 hover:text-red-500 transition duration-150">
            Esci dall'app
          </button>

        </div>
      </div>
    );
  };

  const EndShiftScreen = () => (
    <div className="flex flex-col items-center justify-center min-h-screen bg-green-50 p-4">
      <CheckCircle className="w-20 h-20 text-green-600 mb-6" />
      <h1 className="text-3xl font-bold text-gray-800 mb-4">Turno Concluso!</h1>
      <p className="text-lg text-gray-600 mb-8">Grazie, tutti i dati sono stati inviati all'ufficio.</p>
      
      <div className="w-full max-w-md bg-white p-6 rounded-xl shadow-lg text-center">
        <p className="text-sm text-gray-500 mb-4">Riepilogo KM:</p>
        <p className="text-3xl font-extrabold text-indigo-600 mb-2">{currentShift.kmEnd - currentShift.kmStart} KM percorsi</p>
        <p className="text-sm text-gray-700">Inizio: {currentShift.kmStart} | Fine: {currentShift.kmEnd}</p>
      </div>

      <button
        onClick={handleLogout}
        className="mt-8 w-full max-w-xs py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition duration-150 shadow-md"
      >
        <LogOut className="w-5 h-5 mr-2 inline" /> Chiudi e Torna al Login
      </button>
    </div>
  );


  // Gestione della schermata da mostrare
  let content;
  switch (screen) {
    case 'LOGIN':
      content = <LoginScreen />;
      break;
    case 'START_SHIFT':
      content = <StartShiftScreen />;
      break;
    case 'IN_SERVICE':
      content = <InServiceScreen />;
      break;
    case 'END_SHIFT':
      content = <EndShiftScreen />;
      break;
    default:
      content = <LoginScreen />;
  }

  return (
    <div className="font-sans min-h-screen">
      {/* Sistema di Notifica Globale */}
      {(error || success) && (
        <div className={`fixed top-4 right-4 z-[100] p-4 rounded-lg shadow-xl text-white ${error ? 'bg-red-500' : 'bg-green-500'}`}>
          {error ? <AlertTriangle className="w-5 h-5 mr-2 inline" /> : <CheckCircle className="w-5 h-5 mr-2 inline" />}
          {error || success}
        </div>
      )}
      {content}
    </div>
  );
};

export default App;