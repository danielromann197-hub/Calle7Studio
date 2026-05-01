// IMPORTANT: Reemplazar con tu configuración real de Firebase
// 1. Ve a la consola de Firebase (console.firebase.google.com)
// 2. Crea un proyecto y una aplicación Web
// 3. Copia el objeto firebaseConfig y pégalo aquí
window.firebaseConfig = {
    apiKey: "AIzaSyDeZzO_MGmfpMLAaNDu_ydP7rAZYugsDWg",
    authDomain: "calle7studio-d2728.firebaseapp.com",
    projectId: "calle7studio-d2728",
    storageBucket: "calle7studio-d2728.firebasestorage.app",
    messagingSenderId: "654253933463",
    appId: "1:654253933463:web:5316c4884124cc07797ad2",
    measurementId: "G-5GJVJZFW4Q"
};
const firebaseConfig = window.firebaseConfig;

// Iniciar Firebase (Solo si el API Key es válido)
window.appConfig = null;
window.auth = null;
window.db = null;

try {
    if (firebaseConfig.apiKey !== "AQUI_TU_API_KEY") {
        window.appConfig = firebase.initializeApp(firebaseConfig);
        window.auth = firebase.auth();
        window.db = firebase.firestore();
        console.log("🔥 Firebase inicializado correctamente.");
    } else {
        console.warn("⚠️ Firebase NO está configurado. Reemplaza las credenciales en assets/firebase-config.js");
        // Activamos un modo MOCK (Simulación) para que puedas probar la interfaz
        window.MOCK_MODE = true;
    }
} catch (error) {
    console.error("Error inicializando Firebase:", error);
}

// ------ FUNCIONES DEL MOCK (SIMULADOR) PARA PRUEBAS SIN CONFIGURAR FIREBASE Y ESTILIZACIÓN ------

// Estado inicial simulado
const mockData = {
    users: [
        { id: 'admin1', name: 'Jefe Calle 7', email: 'admin@calle7.com', role: 'admin' },
        { id: 'emp1', name: 'Diseñador', email: 'diseno@calle7.com', role: 'empleado' }
    ],
    tasks: [
        { id: 't1', title: 'Crear Banner', desc: 'Banner principal del sitio', assignee: 'emp1', priority: 'high', status: 'todo' },
        { id: 't2', title: 'Revisar Cuentas', desc: 'Evaluar campaña facebook', assignee: 'admin1', priority: 'medium', status: 'progress' }
    ],
    finances: [
        { id: 'f1', concept: 'Pago Cliente X', type: 'ingreso', amount: 15000, date: new Date().toISOString() },
        { id: 'f2', concept: 'Suscripción Software', type: 'egreso', amount: 500, date: new Date().toISOString() }
    ],
    financing: [
        { id: 'fn1', client: 'Estudio Creativo Alpha', concept: 'Web Inmobiliaria', total: 45000, paid: 15000, createdAt: new Date().toISOString() },
        { id: 'fn2', client: 'Gimnasio FitLife', concept: 'App de Reservas', total: 60000, paid: 45000, createdAt: new Date().toISOString() }
    ],
    clients: [
        { id: 'cl1', name: 'Estudio Creativo Alpha', contact: 'Roberto Alpha', email: 'roberto@alpha.com', status: 'active' },
        { id: 'cl2', name: 'Gimnasio FitLife', contact: 'Laura Fit', email: 'laura@fitlife.com', status: 'active' },
        { id: 'cl3', name: 'Café de la Esquina', contact: 'Don Pepe', email: 'pepe@cafe.com', status: 'lead' }
    ]
};

// Si LocalStorage no tiene datos y estamos en Mock Mode, iniciamos con mockData
if (!localStorage.getItem('calle7_mock_data') && window.MOCK_MODE) {
    localStorage.setItem('calle7_mock_data', JSON.stringify(mockData));
}

window.getMockData = function() {
    return JSON.parse(localStorage.getItem('calle7_mock_data'));
}
window.saveMockData = function(data) {
    localStorage.setItem('calle7_mock_data', JSON.stringify(data));
}
