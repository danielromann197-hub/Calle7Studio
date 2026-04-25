document.addEventListener('DOMContentLoaded', () => {
    // ---- 1. AUTHENTICATION & ROLE CHECK ----
    let currentUser = null;

    if (window.MOCK_MODE) {
        const storedUser = localStorage.getItem('calle7_current_user');
        if (!storedUser) {
            window.location.href = 'login.html';
            return;
        }
        currentUser = JSON.parse(storedUser);
        initApp();
    } else {
        // En Firebase Real, usamos onAuthStateChanged
        auth.onAuthStateChanged(async (user) => {
            if (user) {
                // Fetch User Role from Firestore
                try {
                    const doc = await db.collection('users').doc(user.uid).get();
                    if(doc.exists) {
                        currentUser = { id: user.uid, email: user.email, ...doc.data() };
                        initApp();
                    } else {
                        // User exists in auth but no profile in firestore
                        auth.signOut();
                        window.location.href = 'login.html';
                    }
                } catch(e) {
                    console.error("Error fetching user data", e);
                }
            } else {
                window.location.href = 'login.html';
            }
        });
    }

    function initApp() {
        // Hide loader, show app
        document.getElementById('loader').style.display = 'none';
        document.getElementById('portalApp').style.display = 'flex';

        // Set User Info in UI
        document.getElementById('userNameDisplay').textContent = currentUser.name || currentUser.email;
        const roleBadge = document.getElementById('userRoleBadge');
        roleBadge.textContent = currentUser.role.toUpperCase();

        if(currentUser.role === 'admin') {
            roleBadge.style.color = 'var(--danger)';
            roleBadge.style.borderColor = 'var(--danger)';
            roleBadge.style.backgroundColor = 'rgba(255, 71, 87, 0.1)';
        }

        // Apply Role Restrictions (Hide admin elements for empleados)
        if (currentUser.role !== 'admin') {
            const adminEls = document.querySelectorAll('.admin-only');
            adminEls.forEach(el => el.classList.add('hidden'));
        }

        setupNavigation();
        setupDragAndDrop();
        setupModals();
        
        // Initial Data Load
        loadUsers();
        loadTasks();
        if(currentUser.role === 'admin') {
            loadFinances();
            loadFinancing();
        }
    }

    // ---- 2. NAVIGATION ----
    function setupNavigation() {
        const navLinks = document.querySelectorAll('.nav-link');
        const views = document.querySelectorAll('.view-section');

        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = link.getAttribute('data-target');
                
                // Update active link
                navLinks.forEach(l => l.classList.remove('active'));
                link.classList.add('active');

                // Update active view
                views.forEach(v => v.classList.remove('active'));
                document.getElementById(targetId).classList.add('active');
            });
        });

        // Logout
        document.getElementById('logoutBtn').addEventListener('click', () => {
            if (window.MOCK_MODE) {
                localStorage.removeItem('calle7_current_user');
                window.location.href = 'login.html';
            } else {
                auth.signOut().then(() => window.location.href = 'login.html');
            }
        });
    }

    // ---- 3. DRAG & DROP (KANBAN) ----
    function setupDragAndDrop() {
        const lists = [
            document.getElementById('list-todo'),
            document.getElementById('list-progress'),
            document.getElementById('list-done')
        ];

        lists.forEach(list => {
            new Sortable(list, {
                group: 'kanban',
                animation: 150,
                ghostClass: 'sortable-ghost',
                onEnd: function (evt) {
                    const itemEl = evt.item;  // dragged HTMLElement
                    const newStatus = evt.to.parentElement.getAttribute('data-status');
                    const taskId = itemEl.getAttribute('data-id');

                    // Update task status in DB
                    updateTaskStatus(taskId, newStatus);
                    updateCounters();
                },
            });
        });
    }

    // ---- 4. MODALS LOGIC ----
    function setupModals() {
        const btnsOpen = {
            'btnNewTask': 'modalTask',
            'btnDashNewTask': 'modalTask',
            'btnNewUser': 'modalUser',
            'btnNewFinancing': 'modalFinancing'
        };

        // Open specific modals
        for (let btnId in btnsOpen) {
            const btn = document.getElementById(btnId);
            if(btn) {
                btn.addEventListener('click', () => {
                    document.getElementById(btnsOpen[btnId]).classList.add('active');
                });
            }
        }

        // Finance specific modals mapping
        const bIngreso = document.getElementById('btnNewIngreso');
        const bEgreso = document.getElementById('btnNewEgreso');
        if(bIngreso) bIngreso.addEventListener('click', () => {
             const txType = document.getElementById('txType');
             txType.innerHTML = '<option value="ingreso">Ingreso (+)</option>';
             txType.value = 'ingreso';
             document.getElementById('modalTransaction').classList.add('active');
        });
        if(bEgreso) bEgreso.addEventListener('click', () => {
             const txType = document.getElementById('txType');
             txType.innerHTML = '<option value="egreso">Egreso (-)</option>';
             txType.value = 'egreso';
             document.getElementById('modalTransaction').classList.add('active');
        });

        // Close modals
        const btnsClose = document.querySelectorAll('[data-close]');
        btnsClose.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const modalId = btn.getAttribute('data-close');
                document.getElementById(modalId).classList.remove('active');
            });
        });

        // Form Submissions
        if(document.getElementById('formTransaction')) {
            document.getElementById('formTransaction').addEventListener('submit', (e) => {
                e.preventDefault();
                createNewTransaction();
            });
        }

        if(document.getElementById('formUser')) {
            document.getElementById('formUser').addEventListener('submit', (e) => {
                e.preventDefault();
                createNewUser();
            });
        }

        if(document.getElementById('formFinancing')) {
            document.getElementById('formFinancing').addEventListener('submit', (e) => {
                e.preventDefault();
                createNewFinancing();
            });
        }
    }

    // ---- 5. DATA MANAGEMENT (MOCK / FIREBASE ABSTRACTION) ----

    // Render Tasks
    function loadTasks() {
        let tasks = [];
        if (window.MOCK_MODE) {
            tasks = getMockData().tasks;
            renderTasks(tasks);
        } else {
            // Realtime listener for Firestore
            db.collection('tasks').onSnapshot(snapshot => {
                tasks = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));
                renderTasks(tasks);
            });
        }
    }

    function renderTasks(tasks) {
        const lTodo = document.getElementById('list-todo');
        const lProgress = document.getElementById('list-progress');
        const lDone = document.getElementById('list-done');
        
        lTodo.innerHTML = ''; lProgress.innerHTML = ''; lDone.innerHTML = '';

        let totalTasks = 0;
        let progressTasks = 0;
        
        let allTasksForDash = [];

        tasks.forEach(task => {
            // Un empleado solo ve sus propias tareas (a menos que sea admin)
            if(currentUser.role !== 'admin' && task.assignee !== currentUser.id) return;
            
            totalTasks++;
            if(task.status === 'progress') progressTasks++;
            allTasksForDash.push(task);

            const card = document.createElement('div');
            card.className = 'task-card';
            card.setAttribute('data-id', task.id);
            
            // Reemplazamos ID de usuario por nombre si estamos en MOCK.
            // (En Firebase sería mejor guardar el displayName en la tarea también)
            let assigneeName = task.assigneeName || task.assignee;
            if(window.MOCK_MODE) {
                const u = window.getMockData().users.find(u => u.id === task.assignee);
                assigneeName = u ? u.name : task.assignee;
            }

            let labelHtml = '';
            if(task.labelColor) {
                labelHtml = `<div class="task-label-strip label-color-${task.labelColor}"></div>`;
            }

            let dueDateHtml = '';
            if(task.dueDate) {
                // Convert YYYY-MM-DD to readable format
                const dDate = new Date(task.dueDate + 'T12:00:00');
                const dStr = dDate.toLocaleDateString('es-MX', {day: '2-digit', month: 'short'});
                dueDateHtml = `<span class="due-date" style="margin-left:8px; font-size:0.75rem;"><i class="fa-regular fa-clock"></i> ${dStr}</span>`;
            }

            card.innerHTML = `
                ${labelHtml}
                <div class="task-title">${task.title}</div>
                <div class="task-desc">${task.desc}</div>
                <div class="task-meta">
                    <span class="assignee"><i class="fa-regular fa-user"></i> ${assigneeName}</span>
                    <div>
                        <span class="priority-${task.priority}"><i class="fa-solid fa-flag"></i></span>
                        ${dueDateHtml}
                    </div>
                </div>
            `;
            
            // Click to edit detailed task
            card.addEventListener('click', () => openTaskDetails(task));

            if (task.status === 'todo') lTodo.appendChild(card);
            else if (task.status === 'progress') lProgress.appendChild(card);
            else if (task.status === 'done') lDone.appendChild(card);
        });

        // UPDATE DASHBOARD METRICS
        const dashV1 = document.getElementById('dashVal1');
        const dashV2 = document.getElementById('dashVal2');
        if(dashV1) dashV1.textContent = totalTasks;
        if(dashV2) dashV2.textContent = progressTasks;

        // POPULATE DASHBOARD RECENT TASKS (Last 5)
        const dTasks = document.getElementById('dashTasksList');
        if(dTasks) {
            dTasks.innerHTML = '';
            // Sort newest first
            const recent = allTasksForDash.sort((a,b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0, 5);
            recent.forEach(t => {
                let statusBadge = '';
                if(t.status === 'todo') statusBadge = '<span class="badge empleado">Pendiente</span>';
                if(t.status === 'progress') statusBadge = '<span class="badge admin">En Progreso</span>';
                if(t.status === 'done') statusBadge = '<span class="badge ingreso">Terminado</span>';
                
                let assigneeName = t.assigneeName || t.assignee;
                if(window.MOCK_MODE) {
                     const u = window.getMockData().users.find(u => u.id === t.assignee);
                     assigneeName = u ? u.name : t.assignee;
                }

                dTasks.innerHTML += `
                    <tr>
                        <td><strong>${t.title}</strong><br><small style="color:var(--text-muted)">${assigneeName}</small></td>
                        <td class="text-right">${statusBadge}</td>
                    </tr>
                `;
            });
        }

        updateCounters();
    }

    function updateCounters() {
        document.getElementById('count-todo').textContent = document.getElementById('list-todo').children.length;
        document.getElementById('count-progress').textContent = document.getElementById('list-progress').children.length;
        document.getElementById('count-done').textContent = document.getElementById('list-done').children.length;
    }

    function updateTaskStatus(taskId, status) {
        if (window.MOCK_MODE) {
            const data = getMockData();
            const idx = data.tasks.findIndex(t => t.id === taskId);
            if(idx !== -1) {
                data.tasks[idx].status = status;
                saveMockData(data);
            }
        } else {
            db.collection('tasks').doc(taskId).update({ status });
        }
    }

    // ---- INLINE TRELLO COMPOSER ----
    window.showInlineComposer = function(btnElement, status) {
        // Hide button
        btnElement.style.display = 'none';
        
        // Build composer UI
        const composer = document.createElement('div');
        composer.className = 'inline-composer';
        composer.innerHTML = `
            <textarea class="inline-composer-input" placeholder="Introduce un título o pega un enlace" rows="3" autofocus></textarea>
            <div class="inline-composer-actions">
                <button class="trello-btn-primary btn-add-submit">Añadir tarjeta</button>
                <button class="trello-close-icon"><i class="fa-solid fa-xmark"></i></button>
            </div>
        `;

        // Insert before the button
        btnElement.parentNode.insertBefore(composer, btnElement);

        const textarea = composer.querySelector('.inline-composer-input');
        const btnAdd = composer.querySelector('.btn-add-submit');
        const btnClose = composer.querySelector('.trello-close-icon');

        // Focus
        setTimeout(() => textarea.focus(), 50);

        // Submit logic
        const submitInline = () => {
            const title = textarea.value.trim();
            if(!title) {
                textarea.focus();
                return;
            }

            const newTask = {
                title, 
                desc: '', 
                assignee: '', 
                assigneeName: '', 
                priority: 'medium', 
                labelColor: '', 
                dueDate: '',
                status: status, 
                createdAt: new Date().toISOString()
            };

            if (window.MOCK_MODE) {
                const data = getMockData();
                newTask.id = 't' + Date.now();
                data.tasks.push(newTask);
                saveMockData(data);
                loadTasks(); 
            } else {
                db.collection('tasks').add(newTask);
            }
            // Cleanup
            closeInline();
        };

        const closeInline = () => {
            composer.remove();
            btnElement.style.display = 'flex';
        };

        btnAdd.onclick = submitInline;
        btnClose.onclick = closeInline;
        textarea.onkeydown = (e) => {
            if(e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submitInline();
            }
            if(e.key === 'Escape') closeInline();
        };
    };

    // ---- TRELLO EDIT MODAL LOGIC ----
    function openTaskDetails(task) {
        document.getElementById('editTaskId').value = task.id;
        document.getElementById('editTaskTitle').value = task.title;
        document.getElementById('editTaskDesc').value = task.desc;
        document.getElementById('editTaskAssignee').value = task.assignee;
        document.getElementById('editTaskPriority').value = task.priority;
        const eDate = document.getElementById('editTaskDueDate');
        if(eDate) eDate.value = task.dueDate || '';
        
        // Select color radio
        const cRadios = document.querySelectorAll('input[name="eColor"]');
        cRadios.forEach(r => r.checked = false);
        if(task.labelColor) {
            const r = document.querySelector(`input[name="eColor"][value="${task.labelColor}"]`);
            if(r) r.checked = true;
        } else {
             document.querySelector('input[name="eColor"][value=""]').checked = true;
        }

        // Logic for Delete button (Admin only)
        const btnDelete = document.getElementById('btnDeleteTask');
        if(currentUser.role === 'admin') {
            btnDelete.style.display = 'inline-flex';
        } else {
            btnDelete.style.display = 'none';
        }

        // Mark as Done logic
        const btnDone = document.getElementById('btnMarkDone');
        if(task.status !== 'done') {
            btnDone.style.display = 'inline-flex';
            btnDone.onclick = (e) => {
                e.preventDefault();
                updateTaskStatus(task.id, 'done');
                document.getElementById('modalTaskDetail').classList.remove('active');
            };
        } else {
            btnDone.style.display = 'none';
        }

        // Set Origin List Badge
        let originListName = 'Por Hacer';
        if (task.status === 'progress') originListName = 'En Progreso';
        if (task.status === 'done') originListName = 'Terminado';
        document.getElementById('taskOriginList').innerHTML = `en la lista <span>${originListName}</span>`;

        // Google Calendar btn logic
        const btnCal = document.getElementById('btnGoogleCalendar');
        if (btnCal) {
            btnCal.onclick = (e) => {
                e.preventDefault();
                const tTitle = document.getElementById('editTaskTitle').value || 'Sin Título';
                const tDesc = document.getElementById('editTaskDesc').value || '';
                const tDateStr = document.getElementById('editTaskDueDate').value;
                
                let datesParam = '';
                if(tDateStr) {
                    const d = tDateStr.replace(/-/g, '');
                    let dateObj = new Date(tDateStr + 'T12:00:00');
                    dateObj.setDate(dateObj.getDate() + 1);
                    let nextDay = dateObj.toISOString().split('T')[0].replace(/-/g, '');
                    datesParam = `&dates=${d}/${nextDay}`;
                }

                const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(tTitle)}&details=${encodeURIComponent(tDesc)}${datesParam}`;
                window.open(url, '_blank');
            };
        }

        document.getElementById('modalTaskDetail').classList.add('active');
    }

    document.getElementById('formTaskEdit').addEventListener('submit', (e) => {
        e.preventDefault();
        saveEditedTask();
    });

    function saveEditedTask() {
        const id = document.getElementById('editTaskId').value;
        const title = document.getElementById('editTaskTitle').value;
        const desc = document.getElementById('editTaskDesc').value;
        const assignee = document.getElementById('editTaskAssignee').value;
        const assigneeName = document.getElementById('editTaskAssignee').options[document.getElementById('editTaskAssignee').selectedIndex].text;
        const priority = document.getElementById('editTaskPriority').value;
        const dueDateEl = document.getElementById('editTaskDueDate');
        const dueDate = dueDateEl ? dueDateEl.value : '';
        
        const colorInput = document.querySelector('input[name="eColor"]:checked');
        const labelColor = colorInput ? colorInput.value : '';

        if (window.MOCK_MODE) {
            const data = getMockData();
            const idx = data.tasks.findIndex(t => t.id === id);
            if(idx !== -1) {
                data.tasks[idx] = { ...data.tasks[idx], title, desc, assignee, assigneeName, priority, labelColor, dueDate };
                saveMockData(data);
                loadTasks();
            }
        } else {
            db.collection('tasks').doc(id).update({
                title, desc, assignee, assigneeName, priority, labelColor, dueDate
            });
        }
        document.getElementById('modalTaskDetail').classList.remove('active');
    }

    document.getElementById('btnDeleteTask').addEventListener('click', (e) => {
        e.preventDefault();
        if(!confirm("¿Estás seguro de que deseas eliminar esta tarea de forma permanente?")) return;
        
        const id = document.getElementById('editTaskId').value;
        if (window.MOCK_MODE) {
            const data = getMockData();
            data.tasks = data.tasks.filter(t => t.id !== id);
            saveMockData(data);
            loadTasks();
        } else {
            db.collection('tasks').doc(id).delete();
        }
        document.getElementById('modalTaskDetail').classList.remove('active');
    });

    // Render Users
    function loadUsers() {
        if (window.MOCK_MODE) {
            const users = getMockData().users;
            populateUserSelects(users);
            if(currentUser.role === 'admin') renderUsersTable(users);
        } else {
            db.collection('users').onSnapshot(snapshot => {
                const users = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));
                populateUserSelects(users);
                if(currentUser.role === 'admin') renderUsersTable(users);
            });
        }
    }

    function populateUserSelects(users) {
        const select1 = document.getElementById('taskAssignee');
        const select2 = document.getElementById('editTaskAssignee');
        [select1, select2].forEach(select => {
            if(!select) return;
            select.innerHTML = '<option value="">Selecciona alguien...</option>';
            users.forEach(u => {
                const displayName = u.name || u.email || 'Usuario';
                select.innerHTML += `<option value="${u.id}">${displayName}</option>`;
            });
        });
    }

    function renderUsersTable(users) {
        const tbody = document.getElementById('usersList');
        if(!tbody) return;
        tbody.innerHTML = '';
        users.forEach(u => {
            tbody.innerHTML += `
                <tr>
                    <td><strong>${u.name}</strong></td>
                    <td>${u.email}</td>
                    <td><span class="badge ${u.role}">${u.role.toUpperCase()}</span></td>
                    <td>—</td>
                </tr>
            `;
        });
        
        // Dash Metric
        const dashV3 = document.getElementById('dashVal3');
        if(dashV3) dashV3.textContent = users.length;
    }

    // (Admin no Firebase Auth directly via Client side securely for creating users, 
    // usually requires Firebase Admin SDK. For prototype we show UI mocking)
    function createNewUser() {
        const name = document.getElementById('uName').value;
        const email = document.getElementById('uEmail').value;
        const role = document.getElementById('uRole').value;

        if (window.MOCK_MODE) {
            const data = getMockData();
            data.users.push({ id: 'u'+Date.now(), name, email, role, password: 'mocked' });
            saveMockData(data);
            loadUsers();
        } else {
            alert('En Firebase real, requieres una Cloud Function o secondary app instance para crear cuentas sin cerrar la sesión actual. Contáctame para habilitarlo a nivel de servidor.');
        }

        document.getElementById('modalUser').classList.remove('active');
        document.getElementById('formUser').reset();
    }

    // Render Finances (Admin)
    function loadFinances() {
        if (window.MOCK_MODE) {
            const finances = getMockData().finances;
            renderFinances(finances);
        } else {
            // Sort by Date desc locally after fetch, or via query
            db.collection('finances').onSnapshot(snapshot => {
                const finances = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));
                renderFinances(finances.sort((a,b) => new Date(b.date) - new Date(a.date)));
            });
        }
    }

    function renderFinances(txs) {
        const tbIngresos = document.getElementById('transactionsListIngresos');
        const tbEgresos = document.getElementById('transactionsListEgresos');
        if(!tbIngresos || !tbEgresos) return;
        
        tbIngresos.innerHTML = '';
        tbEgresos.innerHTML = '';
        
        let totalIncome = 0;
        let totalExpense = 0;
        let countIn = 0;
        let countOut = 0;
        
        let topIngreso = 0;
        let recaudadoHoy = 0;
        
        const todayStr = new Date().toLocaleDateString('es-MX', {day: '2-digit', month: 'short', year:'numeric'});

        txs.forEach(tx => {
            const amountObj = parseFloat(tx.amount);
            const dateStr = new Date(tx.date).toLocaleDateString('es-MX', {day: '2-digit', month: 'short', year:'numeric'});
            
            let rowHtml = `
                <tr>
                    <td><small style="color:var(--text-muted)">${dateStr}</small></td>
                    <td><strong>${tx.concept}</strong></td>
                    <td class="text-right ${tx.type === 'ingreso' ? 'positive' : 'negative'}">$${amountObj.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                    <td><i class="fa-solid fa-trash action-trash" title="Eliminar Registro"></i></td>
                </tr>
            `;

            if(tx.type === 'ingreso') {
                totalIncome += amountObj;
                countIn++;
                tbIngresos.innerHTML += rowHtml;
                
                if(amountObj > topIngreso) topIngreso = amountObj;
                if(dateStr === todayStr) recaudadoHoy += amountObj;
                
            } else {
                totalExpense += amountObj;
                countOut++;
                tbEgresos.innerHTML += rowHtml;
            }
        });

        const balance = totalIncome - totalExpense;
        
        // Update Finance Tab UI
        document.getElementById('f-income').textContent = `$${totalIncome.toLocaleString('en-US',{minimumFractionDigits:2})}`;
        document.getElementById('f-expense').textContent = `$${totalExpense.toLocaleString('en-US',{minimumFractionDigits:2})}`;
        
        document.getElementById('f-income-count').textContent = `${countIn} pagos`;
        document.getElementById('f-expense-count').textContent = `${countOut} gastos`;

        const balEl = document.getElementById('f-balance');
        balEl.textContent = `$${balance.toLocaleString('en-US',{minimumFractionDigits:2})}`;
        const balStatus = document.getElementById('f-balance-status');
        if(balance > 0) balStatus.textContent = "Excelente";
        else if (balance < 0) balStatus.textContent = "Pérdida";
        else balStatus.textContent = "A ras";

        // Update Dashboard Summary Stats (If exist)
        const dIngresos = document.getElementById('dash-ingresos');
        const dEgresos = document.getElementById('dash-egresos');
        const dBalance = document.getElementById('dash-balance');
        const dashTop = document.getElementById('dashVal4');
        const dashHoy = document.getElementById('dash-hoy');
        
        if(dIngresos) {
            dIngresos.textContent = `$${totalIncome.toLocaleString('en-US',{minimumFractionDigits:2})}`;
            dEgresos.textContent = `$${totalExpense.toLocaleString('en-US',{minimumFractionDigits:2})}`;
            dBalance.textContent = `$${balance.toLocaleString('en-US',{minimumFractionDigits:2})}`;
            if(balance < 0) dBalance.classList.replace('text-main', 'negative');
            else dBalance.classList.replace('negative', 'text-main');
            
            dashTop.textContent = `$${topIngreso.toLocaleString('en-US',{minimumFractionDigits:2})}`;
            dashHoy.textContent = `$${recaudadoHoy.toLocaleString('en-US',{minimumFractionDigits:2})}`;
        }

        renderFinanceChart(txs);
    }

    let financeChartInstance = null;
    function renderFinanceChart(txs) {
        const ctx = document.getElementById('financeChart');
        if(!ctx) return;

        // Process data for Chart (Last 6 months)
        const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
        const last6Months = [];
        for(let i=5; i>=0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            last6Months.push({
                name: months[d.getMonth()],
                monthNum: d.getMonth(),
                year: d.getFullYear(),
                income: 0,
                expense: 0
            });
        }

        txs.forEach(tx => {
            const d = new Date(tx.date);
            const m = d.getMonth();
            const y = d.getFullYear();
            const monthIdx = last6Months.findIndex(l => l.monthNum === m && l.year === y);
            if(monthIdx !== -1) {
                if(tx.type === 'ingreso') last6Months[monthIdx].income += parseFloat(tx.amount);
                else last6Months[monthIdx].expense += parseFloat(tx.amount);
            }
        });

        const data = {
            labels: last6Months.map(m => m.name),
            datasets: [
                {
                    label: 'Ingresos',
                    data: last6Months.map(m => m.income),
                    backgroundColor: 'rgba(46, 213, 115, 0.5)',
                    borderColor: '#2ed573',
                    borderWidth: 2,
                    borderRadius: 5,
                },
                {
                    label: 'Egresos',
                    data: last6Months.map(m => m.expense),
                    backgroundColor: 'rgba(255, 71, 87, 0.5)',
                    borderColor: '#ff4757',
                    borderWidth: 2,
                    borderRadius: 5,
                }
            ]
        };

        if(financeChartInstance) {
            financeChartInstance.data = data;
            financeChartInstance.update();
        } else {
            financeChartInstance = new Chart(ctx, {
                type: 'bar',
                data: data,
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#999' } },
                        x: { grid: { display: false }, ticks: { color: '#999' } }
                    },
                    plugins: {
                        legend: { labels: { color: '#f5f5f5', font: { family: 'Inter' } } }
                    }
                }
            });
        }
    }

    function createNewTransaction() {
        const concept = document.getElementById('txConcept').value;
        const type = document.getElementById('txType').value;
        const amount = parseFloat(document.getElementById('txAmount').value);

        const newTx = { concept, type, amount, date: new Date().toISOString() };

        if (window.MOCK_MODE) {
            const data = getMockData();
            newTx.id = 'f'+Date.now();
            data.finances.push(newTx);
            saveMockData(data);
            loadFinances();
        } else {
            db.collection('finances').add(newTx);
        }

        document.getElementById('modalTransaction').classList.remove('active');
        document.getElementById('formTransaction').reset();
    }

    // ---- 6. FINANCING MANAGEMENT ----
    function loadFinancing() {
        if (window.MOCK_MODE) {
            const data = getMockData();
            if(!data.financing) data.financing = []; // Migration for older mock data
            renderFinancing(data.financing);
        } else {
            db.collection('financing').onSnapshot(snapshot => {
                const financing = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));
                renderFinancing(financing);
            });
        }
    }

    function renderFinancing(plans) {
        const tbody = document.getElementById('financingList');
        if(!tbody) return;
        tbody.innerHTML = '';

        let totalAmount = 0;
        let totalPaid = 0;

        plans.forEach(plan => {
            const total = parseFloat(plan.total);
            const paid = parseFloat(plan.paid);
            const remaining = total - paid;
            const percentage = Math.min((paid / total) * 100, 100);

            totalAmount += total;
            totalPaid += paid;

            tbody.innerHTML += `
                <tr>
                    <td><strong>${plan.client}</strong></td>
                    <td>${plan.concept}</td>
                    <td>$${total.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                    <td>
                        <div class="progress-container">
                            <div class="progress-bar" style="width: ${percentage}%"></div>
                        </div>
                        <span class="progress-text">${percentage.toFixed(0)}% Pagado ($${paid.toLocaleString('en-US')})</span>
                    </td>
                    <td class="${remaining > 0 ? 'negative' : 'positive'}">$${remaining.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                    <td>
                        <button class="btn-icon" title="Editar" onclick="alert('Funcionalidad de edición en desarrollo')"><i class="fa-solid fa-pen"></i></button>
                        <button class="btn-icon danger" title="Eliminar" onclick="deleteFinancing('${plan.id}')"><i class="fa-solid fa-trash"></i></button>
                    </td>
                </tr>
            `;
        });

        document.getElementById('financingTotal').textContent = `$${totalAmount.toLocaleString('en-US', {minimumFractionDigits: 2})}`;
        document.getElementById('financingCollected').textContent = `$${totalPaid.toLocaleString('en-US', {minimumFractionDigits: 2})}`;
        document.getElementById('financingPending').textContent = `$${(totalAmount - totalPaid).toLocaleString('en-US', {minimumFractionDigits: 2})}`;
    }

    function createNewFinancing() {
        const client = document.getElementById('fnClient').value;
        const concept = document.getElementById('fnConcept').value;
        const total = parseFloat(document.getElementById('fnTotal').value);
        const paid = parseFloat(document.getElementById('fnPaid').value);

        const newPlan = { client, concept, total, paid, createdAt: new Date().toISOString() };

        if (window.MOCK_MODE) {
            const data = getMockData();
            if(!data.financing) data.financing = [];
            newPlan.id = 'fn'+Date.now();
            data.financing.push(newPlan);
            saveMockData(data);
            loadFinancing();
        } else {
            db.collection('financing').add(newPlan);
        }

        document.getElementById('modalFinancing').classList.remove('active');
        document.getElementById('formFinancing').reset();
    }

    window.deleteFinancing = function(id) {
        if(!confirm("¿Deseas eliminar este plan de financiamiento?")) return;
        
        if (window.MOCK_MODE) {
            const data = getMockData();
            data.financing = data.financing.filter(p => p.id !== id);
            saveMockData(data);
            loadFinancing();
        } else {
            db.collection('financing').doc(id).delete();
        }
    };

    // ---- TRELLO POPOVERS & HEADER LOGIC ----
    const boardTitle = document.getElementById('boardTitle');
    if (boardTitle) {
        const savedTitle = localStorage.getItem('calle7_board_title');
        if(savedTitle) boardTitle.value = savedTitle;

        const saveTitle = () => {
            localStorage.setItem('calle7_board_title', boardTitle.value);
            boardTitle.blur();
        };
        boardTitle.addEventListener('blur', saveTitle);
        boardTitle.addEventListener('keydown', (e) => {
            if(e.key === 'Enter') saveTitle();
        });
    }

    // Load List Colors
    const loadListColors = () => {
        const colors = JSON.parse(localStorage.getItem('calle7_list_colors') || '{}');
        for (let colId in colors) {
            const col = document.getElementById(colId);
            if (col) {
                // remove previous color
                col.className = col.className.replace(/l-color-\S+/g, '').trim();
                if(colors[colId] !== 'default') {
                    col.classList.add(`l-color-${colors[colId]}`);
                }
            }
        }
    };
    loadListColors();

    const vistasPopover = document.getElementById('vistasPopover');
    const btnVistas = document.getElementById('btnVistasPopover');
    if (btnVistas && vistasPopover) {
        btnVistas.addEventListener('click', (e) => {
            e.stopPropagation();
            closePopovers();
            const rect = btnVistas.getBoundingClientRect();
            vistasPopover.style.top = (rect.bottom + 8) + 'px';
            vistasPopover.style.left = rect.left + 'px';
            vistasPopover.classList.add('active');
        });
    }

    const listActionsPopover = document.getElementById('listActionsPopover');
    let currentListTarget = null;
    
    window.openListActions = function(e, colId) {
        e.stopPropagation();
        closePopovers();
        currentListTarget = colId;
        const btn = e.currentTarget;
        const rect = btn.getBoundingClientRect();
        listActionsPopover.style.top = (rect.bottom + 8) + 'px';
        listActionsPopover.style.left = rect.left + 'px';
        listActionsPopover.classList.add('active');
    };

    window.closePopovers = function() {
        if(vistasPopover) vistasPopover.classList.remove('active');
        if(listActionsPopover) listActionsPopover.classList.remove('active');
    };

    document.addEventListener('click', (e) => {
        if (vistasPopover && !vistasPopover.contains(e.target) && btnVistas && !btnVistas.contains(e.target)) {
            vistasPopover.classList.remove('active');
        }
        if (listActionsPopover && !listActionsPopover.contains(e.target)) {
            listActionsPopover.classList.remove('active');
        }
    });

    // Close buttons inside popovers
    const btnCloseVistas = document.getElementById('closeVistasPopover');
    if (btnCloseVistas) btnCloseVistas.addEventListener('click', closePopovers);
    const btnCloseList = document.getElementById('closeListActionsPopover');
    if (btnCloseList) btnCloseList.addEventListener('click', closePopovers);

    // List Color selection
    document.querySelectorAll('.list-color-picker .l-color').forEach(btn => {
        btn.addEventListener('click', (e) => {
            if (!currentListTarget) return;
            const color = e.target.getAttribute('data-color');
            const col = document.getElementById(currentListTarget);
            if (col) {
                // remove prev colors
                col.className = col.className.replace(/l-color-\S+/g, '').trim();
                if(color !== 'default') {
                    col.classList.add(`l-color-${color}`);
                }

                // save
                const colors = JSON.parse(localStorage.getItem('calle7_list_colors') || '{}');
                colors[currentListTarget] = color;
                localStorage.setItem('calle7_list_colors', JSON.stringify(colors));
            }
            closePopovers();
        });
    });

});
