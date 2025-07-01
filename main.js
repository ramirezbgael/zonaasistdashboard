import { supabase } from './supabase.js';

const btnLogout = document.getElementById('btnLogout');
const listEquipos = document.getElementById('equipos');
const btnOpenModal = document.getElementById('btnOpenModal');
const modalContainer = document.getElementById('modalContainer');
const closeModal = document.getElementById('closeModal');

// Modal de agregar item
const btnAddItem = document.getElementById('btnAddItem');
const modalAddItem = document.getElementById('modalAddItem');
const closeAddItemModal = document.getElementById('closeAddItemModal');
const formAddItem = document.getElementById('formAddItem');

async function init() {
    const {
        data: { user },
        error
    } = await supabase.auth.getUser();

    if (error || !user) {
        window.location = 'index.html';
        return;
    }

    loadEquipos();

    btnLogout.addEventListener('click', async () => {
        await supabase.auth.signOut();
        window.location = 'index.html';
    });

    // Modal functionality
    btnOpenModal.addEventListener('click', showModal);
    closeModal.addEventListener('click', hideModal);

    // Close modal when clicking outside
    modalContainer.addEventListener('click', (e) => {
        if (e.target === modalContainer) {
            hideModal();
        }
    });

    // Close modal with Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modalContainer.classList.contains('show')) {
            hideModal();
        }
    });

    // Manejar el submit del formulario
    formAddItem.addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = (await supabase.auth.getUser()).data.user;

        // Obtener la nota más alta actual y sumarle 1
        const { data: ultima } = await supabase
            .from('equipos')
            .select('nota')
            .order('nota', { descending: true })
            .limit(1);

        const nuevaNota = (ultima?.[0]?.nota || 12999) + 1;

        const nuevoEquipo = {
            nota: nuevaNota,
            tipo: document.getElementById('tipo').value,
            marca: document.getElementById('marca').value,
            modelo: document.getElementById('modelo').value,
            color: document.getElementById('color').value,
            contrasena: document.getElementById('contrasena').value,
            condiciones: document.getElementById('condiciones').value,
            problema: document.getElementById('problema').value,
            recibido_por: user.id,
        };

        const { error } = await supabase.from('equipos').insert(nuevoEquipo);
        if (error) {
            alert("Error al guardar equipo: " + error.message);
        } else {
            alert("Equipo agregado con nota #" + nuevaNota);
            formAddItem.reset();
            modalAddItem.classList.remove('show');
            loadEquipos();
        }
    });
}

async function loadEquipos() {
    const equiposScroll = document.getElementById('equiposScroll');
    equiposScroll.innerHTML = '';

    const { data: equipos, error } = await supabase
        .from('equipos')
        .select('id, tipo, marca, modelo, color, nota, problema, pendientes(id, descripcion, status)')
        .order('id', { ascending: true });

    if (error) {
        console.error('Error cargando equipos:', error);
        return;
    }

    equipos.forEach(e => {
        // Tarjeta de equipo estilo Uiverse
        const card = document.createElement('div');
        card.className = 'card';

        // Borde decorativo
        const border = document.createElement('div');
        border.className = 'card__border';
        card.appendChild(border);

        // Título y subtítulo
        const titleContainer = document.createElement('div');
        titleContainer.className = 'card_title__container';
        titleContainer.innerHTML = `
            <span class="card_title">#${e.nota} ${e.marca} ${e.modelo} <span style="color:var(--primary);font-size:0.9em;">${e.color}</span></span>
            <p class="card_paragraph">${e.problema || ''}</p>
        `;
        card.appendChild(titleContainer);

        // Línea divisoria
        const line = document.createElement('hr');
        line.className = 'line';
        card.appendChild(line);

        // Lista de pendientes
        const ul = document.createElement('ul');
        ul.className = 'card__list';

        if (e.pendientes && e.pendientes.length > 0) {
            e.pendientes.forEach(p => {
                const li = document.createElement('li');
                li.className = 'card__list_item';

                // Botón check
                const checkBtn = document.createElement('button');
                checkBtn.type = 'button';
                checkBtn.className = 'check-btn check' + (p.status === 'terminado' ? ' completed' : '');
                checkBtn.title = p.status === 'terminado' ? 'Marcar como pendiente' : 'Marcar como terminado';

                // Si está terminado, muestra el check, si no, deja vacío
                checkBtn.innerHTML = p.status === 'terminado'
                    ? `<svg class="check_svg" fill="currentColor" viewBox="0 0 16 16">
                        <path clip-rule="evenodd" fill-rule="evenodd"
                            d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z">
                        </path>
                    </svg>`
                    : ''; // Si está pendiente, bolita vacía pero visible

                // Evento para marcar/desmarcar pendiente
                checkBtn.addEventListener('click', async () => {
                    const nuevoStatus = p.status === 'terminado' ? 'pendiente' : 'terminado';
                    const { error } = await supabase
                        .from('pendientes')
                        .update({ status: nuevoStatus })
                        .eq('id', p.id);
                    if (!error) {
                        loadEquipos();
                    } else {
                        alert('Error al actualizar pendiente');
                    }
                });

                li.appendChild(checkBtn);

                // Texto del pendiente
                const text = document.createElement('span');
                text.className = 'list_text';
                text.textContent = p.descripcion;
                li.appendChild(text);

                ul.appendChild(li);
            });
        } else {
            const li = document.createElement('li');
            li.className = 'card__list_item';
            li.textContent = 'Sin pendientes.';
            ul.appendChild(li);
        }
        card.appendChild(ul);

        // Botón de acción (puedes personalizar la acción)
        const btn = document.createElement('button');
        btn.className = 'button';
        btn.textContent = 'Marcar como listo';
        btn.onclick = () => {
            // Aquí puedes poner la acción que quieras, por ejemplo, marcar todos los pendientes como terminados
            alert('¡Acción rápida para este equipo!');
        };
        card.appendChild(btn);

        equiposScroll.appendChild(card);
    });
}

async function markDone(id) {
    await supabase.from('pendientes').update({ status: 'terminado' }).eq('id', id);
    loadEquipos();
}

// Show modal
function showModal() {
    modalContainer.classList.add('show');
}

// Hide modal
function hideModal() {
    modalContainer.classList.remove('show');
}

btnAddItem.addEventListener('click', () => {
    modalAddItem.classList.add('show');
});

closeAddItemModal.addEventListener('click', () => {
    modalAddItem.classList.remove('show');
});

// Cerrar modal al hacer click fuera
modalAddItem.addEventListener('click', (e) => {
    if (e.target === modalAddItem) {
        modalAddItem.classList.remove('show');
    }
});

// Cerrar con Escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalAddItem.classList.contains('show')) {
        modalAddItem.classList.remove('show');
    }
});

init();