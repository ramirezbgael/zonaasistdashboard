import { supabase } from './supabase.js';

const btnLogout = document.getElementById('btnLogout');
const listEquipos = document.getElementById('equipos');
const selEquipo = document.getElementById('selEquipo');
const desc = document.getElementById('desc');
const btnAdd = document.getElementById('btnAdd');

async function init() {
    const {
        data: { user },
        error
    } = await supabase.auth.getUser();

    if (error || !user) {
        window.location = 'index.html';
        return;
    }

    const formEquipo = document.getElementById('formEquipo');

    formEquipo.addEventListener('submit', async (e) => {
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
            formEquipo.reset();
            loadEquipos();
        }
    });


    loadEquipos();

    btnLogout.addEventListener('click', async () => {
        await supabase.auth.signOut();
        window.location = 'index.html';
    });

    btnAdd.addEventListener('click', async () => {
        const equipo_id = selEquipo.value;
        const descripcion = desc.value.trim();
        if (!descripcion) return;

        await supabase.from('pendientes').insert({
            equipo_id,
            descripcion,
            status: 'pendiente'
        });

        desc.value = '';
        loadEquipos();
    });
}

async function loadEquipos() {
    const { data: equipos, error } = await supabase
        .from('equipos')
        .select('id, tipo, marca, nota, pendientes(id, descripcion, status)')
        .order('id', { ascending: true });

    if (error) {
        console.error('Error cargando equipos:', error);
        return;
    }

    selEquipo.innerHTML = '';
    listEquipos.innerHTML = '';

    equipos.forEach(e => {
        // estado general del equipo
        let estado = '✅ Listo';
        if (e.pendientes && e.pendientes.some(p => p.status === 'pendiente')) {
            estado = '🛠 En proceso';
        }

        // opción para selector de equipo
        const opt = document.createElement('option');
        opt.value = e.id;
        opt.textContent = `${e.tipo} ${e.marca} [${e.nota}]`;
        selEquipo.appendChild(opt);

        // contenedor del equipo
        const li = document.createElement('li');
        li.textContent = `🖥 ${e.tipo} ${e.marca} [Nota ${e.nota}] - ${estado}`;

        // sublista de pendientes
        const sub = document.createElement('ul');
        if (e.pendientes && e.pendientes.length > 0) {
            e.pendientes.forEach(p => {
                const pli = document.createElement('li');
                pli.textContent = `${p.descripcion} [${p.status}]`;

                if (p.status === 'pendiente') {
                    const btn = document.createElement('button');
                    btn.textContent = '✔';
                    btn.onclick = () => markDone(p.id);
                    pli.appendChild(btn);
                }

                sub.appendChild(pli);
            });
        } else {
            const noPend = document.createElement('li');
            noPend.textContent = 'Sin pendientes.';
            sub.appendChild(noPend);
        }

        li.appendChild(sub);
        listEquipos.appendChild(li);
    });
}

async function markDone(id) {
    await supabase.from('pendientes').update({ status: 'terminado' }).eq('id', id);
    loadEquipos();
}

init();