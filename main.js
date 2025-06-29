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
    .select('id, nombre, pendientes(id, descripcion, status)')
    .order('id', { ascending: true });

  if (error) {
    console.error('Error cargando equipos:', error);
    return;
  }

  selEquipo.innerHTML = '';
  listEquipos.innerHTML = '';

  equipos.forEach(e => {
    // opción para selector de equipo
    const opt = document.createElement('option');
    opt.value = e.id;
    opt.textContent = e.nombre;
    selEquipo.appendChild(opt);

    // listado de pendientes
    const li = document.createElement('li');
    li.textContent = '🖥 ${e.nombre}';

    const sub = document.createElement('ul');
    if (e.pendientes && e.pendientes.length > 0) {
      e.pendientes.forEach(p => {
        const pli = document.createElement('li');
        pli.textContent = '${p.descripcion} [${p.status}]';

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