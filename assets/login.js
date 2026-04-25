document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const emailInput = document.getElementById('email');
    const passInput = document.getElementById('password');
    const errorMsg = document.getElementById('errorMsg');
    const submitBtn = document.getElementById('loginBtn');
    const btnText = submitBtn.querySelector('.btn-text');
    const btnLoader = submitBtn.querySelector('.btn-loader');

    // Si ya está logueado en modo Mock
    if (window.MOCK_MODE && localStorage.getItem('calle7_current_user')) {
        window.location.href = 'portal.html';
        return;
    }

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // UI Loading State
        errorMsg.style.display = 'none';
        btnText.style.display = 'none';
        btnLoader.style.display = 'inline-block';
        submitBtn.disabled = true;

        const email = emailInput.value.trim();
        const pass = passInput.value.trim();

        if (window.MOCK_MODE) {
            // ---- MOCK LOGIN ----
            setTimeout(() => {
                const data = getMockData();
                const user = data.users.find(u => u.email === email);
                
                // Demo: Cualquier contraseña es válida si es >= 6 chars en el mock, 
                // excepto si queremos validar. Solo validamos email.
                if (user && pass.length >= 6) {
                    localStorage.setItem('calle7_current_user', JSON.stringify(user));
                    window.location.href = 'portal.html';
                } else {
                    showError();
                }
            }, 1000);
        } else {
            // ---- FIREBASE REAL LOGIN ----
            try {
                const userCredential = await auth.signInWithEmailAndPassword(email, pass);
                // Extraer el rol de Firestore (opcional si hay claims, aquí usamos un query sencillo)
                const userDoc = await db.collection('users').doc(userCredential.user.uid).get();
                if (userDoc.exists) {
                    const userData = userDoc.data();
                    // Guardar rol localmente de forma temporal solo para UI, 
                    // la verdadera seguridad de Firebase depende de Firestore Rules.
                    localStorage.setItem('calle7_role', userData.role);
                    window.location.href = 'portal.html';
                } else {
                    console.error("Usuario sin documento en Firestore");
                    showError("Usuario autenticado, pero falta el Gafete de Jefe en la Base de Datos (Firestore > users).");
                }
            } catch (error) {
                console.error("Error en login", error);
                // Si Firebase da un error de auth (e.g. mal password)
                if (error.code === 'auth/invalid-credential') {
                    showError("El correo o la contraseña son incorrectos.");
                } else if (error.code) {
                    showError(`Permiso denegado: ${error.message}`);
                } else {
                    showError();
                }
            }
        }
    });

    function showError(customMessage) {
        if(customMessage) {
            errorMsg.innerText = customMessage;
        } else {
            errorMsg.innerText = "Credenciales incorrectas o usuario no encontrado.";
        }

        errorMsg.style.display = 'block';
        btnText.style.display = 'inline-block';
        btnLoader.style.display = 'none';
        submitBtn.disabled = false;
        
        // Animamos el form sacudiéndolo suavemente
        loginForm.animate([
            { transform: 'translateX(0)' },
            { transform: 'translateX(-10px)' },
            { transform: 'translateX(10px)' },
            { transform: 'translateX(-10px)' },
            { transform: 'translateX(10px)' },
            { transform: 'translateX(0)' }
        ], { duration: 400 });
    }
});
