// 1. Conectar con Supabase (Pega tus llaves aquí, manteniendo las comillas)
const supabaseUrl = 'https://iddulhayhisbybqmncye.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlkZHVsaGF5aGlzYnlicW1uY3llIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEyMjg3NjgsImV4cCI6MjEwNjgwNDc2OH0.OO9Uf8nXWfNSA1sCw1HYdA2LiFghhtYfq-IOtWELvGw';

// Inicializamos el cliente de la base de datos
const { createClient } = supabase;
const db = createClient(supabaseUrl, supabaseKey);

// 2. Inicializar el mapa centrado en Oruro (Con Motor de Rotación Mejorado)
const map = L.map('mi_mapa', {
    rotate: true,           
    bearing: 0,             
    touchRotate: true,         // NUEVO: Enciende el giro con 2 dedos por defecto (Modo Negro)
    compassBearing: false,     // NUEVO: Apaga totalmente el sensor de Giroscopio
    shiftKeyMapRotate: true,   // Mantiene la rotación con Shift en PC
    boxZoom: false,            
    rotateControl: {
        closeOnZeroBearing: false, 
        position: 'topleft'        
    }
}).setView([-17.9703, -67.1123], 14);

// Restauramos la capa principal, pero ahora como un Clúster Inteligente
const capaMarcadores = L.markerClusterGroup({
    maxClusterRadius: 50, // Distancia en píxeles para agrupar pines
    spiderfyOnMaxZoom: true, // Separa los pines si están en exactamente la misma coordenada
    showCoverageOnHover: false, // Apaga la sombra azul para un diseño más limpio
    zoomToBoundsOnClick: true // Hace zoom automático al tocar la burbuja de números
}).addTo(map);

// --- GEOLOCALIZACIÓN: Botón de ubicación en tiempo real ---
L.control.locate({
    position: 'topleft',        // Se colocará debajo de los controles de zoom
    strings: {
        title: "Mostrar mi ubicación exacta"
    },
    locateOptions: {
        enableHighAccuracy: true, // Fuerza al celular a encender la antena GPS real
        maxZoom: 18               // Zoom máximo al encontrarte
    },
    keepCurrentZoomLevel: false,  // Permitimos que haga zoom hacia tu posición
    showPopup: false,             // Apagamos el texto por defecto para un look más limpio
    icon: 'leaflet-control-locate-location-arrow', // Icono estándar de GPS
    iconLoading: 'leaflet-control-locate-spinner'  // Icono de carga mientras busca los satélites
}).addTo(map);

// HACK: Secuestrar la brújula para que SOLO sirva para reiniciar al Norte
const botonBrujula = document.querySelector('.leaflet-control-rotate');
if (botonBrujula) {
    const reiniciarNorte = function(e) {
        e.stopPropagation(); // Evita que el plugin cambie de modos al hacer clic
        e.preventDefault();
        map.setBearing(0);   // Regresa el mapa al Norte exacto
    };
    
    // Atrapamos los clics en PC y los toques en Celular antes de que el plugin los procese
    botonBrujula.addEventListener('click', reiniciarNorte, true);
    botonBrujula.addEventListener('touchstart', reiniciarNorte, { passive: false, capture: true });
}

// 3. Cargar el diseño de las calles (Esri Street - Tradicional Limpio)
L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19,
    attribution: 'Tiles © Esri'
}).addTo(map);

console.log("Mapa cargado y conectado a la nube");

// --- MEMORIA DE SESIÓN Y SEGURIDAD ---
let usuarioActualId = null;
let usuarioActualRol = null;
let temporizadorInactividad; // Reloj de los 5 minutos

// 1. Verificar si la sesión ya existe al actualizar la página
function verificarSesion() {
    // sessionStorage retiene los datos al dar F5, pero los borra al cerrar la pestaña
    const idGuardado = sessionStorage.getItem('usuarioActualId');
    const rolGuardado = sessionStorage.getItem('usuarioActualRol');

    if (idGuardado && rolGuardado) {
        // Restaurar variables
        usuarioActualId = parseInt(idGuardado);
        usuarioActualRol = rolGuardado;
        
        // Configurar la pantalla
        document.getElementById('pantalla-login').style.display = 'none';
        document.getElementById('btn_cerrar_sesion').style.display = 'block';

        if (usuarioActualRol === 'admin') {
            document.getElementById('panel-admin').style.display = 'flex';
            document.getElementById('btn_borrar_mis_datos').style.display = 'block';
        }

        // Descargar datos y encender reloj de inactividad
        cargarMarcadores();
        cargarPerimetros();
        iniciarTemporizadorInactividad();
        autoMinimizarMovil();
        iniciarSuscripcionesRealtime();
    }
}

// Permitir iniciar sesión presionando Enter
document.getElementById('in_usuario').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') iniciarSesion();
});
document.getElementById('in_pass').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') iniciarSesion();
});

// 2. Motor de Inicio de Sesión
async function iniciarSesion() {
    const user = document.getElementById('in_usuario').value.trim();
    const pass = document.getElementById('in_pass').value.trim();
    const msgError = document.getElementById('msg_error_login');

    if (!user || !pass) return;

    document.getElementById('btn_ingresar').innerText = "Verificando...";

    const { data, error } = await db.from('usuarios')
        .select('*')
        .eq('username', user)
        .eq('password', pass)
        .single(); 

    if (error || !data) {
        msgError.style.display = 'block'; 
        document.getElementById('btn_ingresar').innerText = "Ingresar";
    } else {
        usuarioActualId = data.id;
        usuarioActualRol = data.rol;
        
        // GUARDAMOS EN MEMORIA DE SESIÓN
        sessionStorage.setItem('usuarioActualId', usuarioActualId);
        sessionStorage.setItem('usuarioActualRol', usuarioActualRol);
        
        document.getElementById('pantalla-login').style.display = 'none';
        document.getElementById('btn_cerrar_sesion').style.display = 'block';
        
        if (usuarioActualRol === 'admin') {
            document.getElementById('panel-admin').style.display = 'flex';
            document.getElementById('btn_borrar_mis_datos').style.display = 'block';
        }

        cargarMarcadores();
        cargarPerimetros();
        iniciarTemporizadorInactividad();
        autoMinimizarMovil();
        iniciarSuscripcionesRealtime();
    }
}

// 3. Función para Cerrar Sesión (Manual o Automática)
function cerrarSesion() {
    sessionStorage.clear(); // Destruimos la memoria
    location.reload();      // Recargamos la página para limpiar todo rastro visual
}

// 4. Sistema de Cierre Automático por Inactividad (5 Minutos)
function reiniciarTiempo() {
    if (!usuarioActualId) return; // Si no hay sesión, no hace nada
    
    clearTimeout(temporizadorInactividad);
    // 900,000 milisegundos = 15 minutos. Si llega a 0, ejecuta cerrarSesion()
    temporizadorInactividad = setTimeout(cerrarSesion, 900000); 
}

function iniciarTemporizadorInactividad() {
    reiniciarTiempo();
    // Le decimos al navegador que si haces CUALQUIERA de estas cosas, el reloj de 5 minutos vuelve a empezar
    window.addEventListener('mousemove', reiniciarTiempo); // Mover ratón
    window.addEventListener('click', reiniciarTiempo);     // Hacer clics
    window.addEventListener('keydown', reiniciarTiempo);   // Tocar teclado
    window.addEventListener('touchstart', reiniciarTiempo);// Tocar pantalla en celular
}

// AL FINALIZAR LA CARGA DEL CÓDIGO, EJECUTAMOS LA VERIFICACIÓN
verificarSesion();


// --- FASE 2: INTERACCIÓN Y FORMULARIO ---

let latitudClic = 0;
let longitudClic = 0;
const panel = document.getElementById('panel-formulario');



// 2. Función para cerrar el panel
function cerrarPanel() {
    panel.style.display = 'none';
    limpiarFormulario();
}

// 3. Función para limpiar los datos escritos
function limpiarFormulario() {
    document.getElementById('in_nombre').value = '';
    document.getElementById('in_propietario').value = '';
    document.getElementById('in_descripcion').value = '';
    document.getElementById('in_aplicable').checked = true;
    document.getElementById('in_foto').value = '';
}

// --- CONEXIÓN REAL A SUPABASE, FORMAS, EDICIÓN Y ELIMINACIÓN ---
let marcadoresDibujados = {}; // Guardará el objeto físico del marcador en el mapa
let ultimoVistoId = localStorage.getItem('ultimo_visto_id') || null; // Recordará el ID del último clic
let listaNegocios = []; // Guardaremos los datos aquí para poder editarlos fácilmente
let idEdicion = null; // Nos dirá si estamos creando o actualizando
let urlFotoActual = null; // Guardará el enlace de la foto mientras editamos

// Función para el botón rojo de "Quitar fotografía" en el panel
function quitarFoto() {
    urlFotoActual = null;
    document.getElementById('in_foto').value = '';
    document.getElementById('contenedor_foto_actual').style.display = 'none';
}

// Funcion para guardarNegocio()
async function guardarNegocio() {
    const nombre = document.getElementById('in_nombre').value;
    const propietario = document.getElementById('in_propietario').value;
    const rubro = document.getElementById('in_rubro').value;
    const descripcion = document.getElementById('in_descripcion').value;
    const aplicable = document.getElementById('in_aplicable').checked;
    const color = document.getElementById('in_color').value;
    const forma = mapaRubroIcono[rubro];
    const archivoFoto = document.getElementById('in_foto').files[0];

    if (!nombre) return alert("Por favor, ponle un nombre al negocio.");
    document.getElementById('btn_guardar').innerText = "Guardando...";

    let urlFinalFoto = urlFotoActual; 
    if (archivoFoto) {
        const nombreArchivo = `${Date.now()}_${archivoFoto.name}`;
        const { data: uploadData, error: uploadError } = await db.storage.from('fotos').upload(nombreArchivo, archivoFoto);
        if (!uploadError) {
            const { data: publicUrlData } = db.storage.from('fotos').getPublicUrl(nombreArchivo);
            urlFinalFoto = publicUrlData.publicUrl;
        }
    }

    const datosGuardar = {
        latitud: latitudClic, longitud: longitudClic, nombre: nombre, propietario: propietario,
        rubro: rubro, descripcion: descripcion, aplicable: aplicable,
        color_marcador: color, forma: forma, foto_url: urlFinalFoto,
        dueño_id: usuarioActualId
    };

    if (idEdicion) await db.from('negocios').update(datosGuardar).eq('id', idEdicion);
    else await db.from('negocios').insert([datosGuardar]);

    cerrarPanel(); // Solo cerramos la ventana. ¡El servidor se encargará de dibujarlo!
}


// --- DICCIONARIO DE ICONOS SVG ---
const iconosSVG = {
    taza: { path: 'M4 19h16v2H4zM20 3H4v10c0 2.21 1.79 4 4 4h6c2.21 0 4-1.79 4-4v-3h2c1.11 0 2-.89 2-2V5c0-1.11-.89-2-2-2zm-4 10c0 1.1-.9 2-2 2H8c-1.1 0-2-.9-2-2V5h10v8zm4-5h-2V5h2v3z', ancla: [14, 28] },
    cubiertos: { path: 'M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm5-3v8h2.5v8H21V2c-2.76 0-5 2.24-5 5z', ancla: [14, 28] },
    pizza: { path: 'M12 2C8.43 2 5.23 3.54 3.01 6L12 22l8.99-16C18.78 3.55 15.57 2 12 2zM7 7c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2zm5 8c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z', ancla: [14, 28] },
    coctel: { path: 'M21 5V3H3v2l8 9v5H6v2h12v-2h-5v-5l8-9zM7.43 7L5.66 5h12.69l-1.78 2H7.43z', ancla: [14, 28] },
    ropa: { path: 'M21.99 8c0-.72-.37-1.35-.94-1.7L12 1 2.95 6.3C2.38 6.65 2 7.28 2 8v10c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2l-.01-10zM12 19L3 14l5-3.33V19h8v-8.33L21 14l-9 5z', ancla: [14, 28] },
    carrito: { path: 'M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z', ancla: [14, 28] },
    timbre: { path: 'M2 17h20v2H2v-2zm11.84-9.21A2 2 0 0 0 12 4a2 2 0 0 0-1.84 3.79C6.25 8.6 3.27 11.93 3 16h18c-.27-4.07-3.25-7.4-7.16-8.21z', ancla: [14, 28] },
    estrella: { path: 'M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z', ancla: [14, 28] }
};

// Diccionario para conectar automáticamente el rubro con su icono
const mapaRubroIcono = {
    "Cafe, Reposteria y Bebidas": "taza",
    "Restaurantes y Gastronomia": "cubiertos",
    "Comida Rapida y Casual": "pizza",
    "Bares y Pubs": "coctel",
    "Retail y Moda": "ropa",
    "Comercio y Markets": "carrito",
    "Servicios": "timbre",
    "Otros": "estrella"
};

// 2. Dibujar Marcador (Incluyendo las nuevas formas dinámicas y foto)
function dibujarMarcador(negocio) {
    let marcador;
    
    // Verificamos si la forma existe en nuestro diccionario SVG
    if (iconosSVG[negocio.forma]) {
        const configSVG = iconosSVG[negocio.forma];
        const iconoSvgDinamico = L.divIcon({ 
            html: `<svg width="28" height="28" viewBox="0 0 24 24" fill="${negocio.color_marcador}" stroke="white" stroke-width="0.8"><path d="${configSVG.path}"/></svg>`, 
            className: '', iconSize: [28, 28], iconAnchor: configSVG.ancla 
        });
        marcador = L.marker([negocio.latitud, negocio.longitud], {icon: iconoSvgDinamico});
    } else {
        // Círculo por defecto por si hay un dato muy antiguo guardado
        marcador = L.circleMarker([negocio.latitud, negocio.longitud], { radius: 9, fillColor: negocio.color_marcador, color: "#fff", weight: 2, fillOpacity: 0.9 });
    }

    marcador.addTo(capaMarcadores);
    marcadoresDibujados[negocio.id] = marcador; 
    
    // Rastrear cuando se abre la ventana
    marcador.on('popupopen', function() {
        ultimoVistoId = negocio.id;
        localStorage.setItem('ultimo_visto_id', negocio.id); 
        document.getElementById('btn_ultimo_visto').style.display = 'block';
    });

    const imgContenedor = negocio.foto_url ? `<img src="${negocio.foto_url}" style="width: 100%; height: 120px; object-fit: cover; border-radius: 4px; margin-bottom: 5px;">` : '';
    const estado = negocio.aplicable ? "✅ Aplicable" : "❌ No Aplicable";
    
    const popupHTML = `
        <div style="min-width: 180px; font-family: sans-serif;">
            ${imgContenedor}
            <h3 style="margin: 0 0 5px 0; color: ${negocio.color_marcador};">${negocio.nombre}</h3>
            <p style="margin: 2px 0; font-size: 13px;"><b>Propietario:</b> ${negocio.propietario}</p>
            <p style="margin: 2px 0; font-size: 13px;"><b>Rubro:</b> ${negocio.rubro}</p>
            <p style="margin: 8px 0; font-size: 14px;">${negocio.descripcion}</p>
            <hr style="border: 0.5px solid #ccc; margin: 5px 0;">
            <p style="margin: 0 0 10px 0; font-weight: bold; font-size: 14px;">${estado}</p>
            
            <div style="display: flex; gap: 5px;">
                <button onclick="activarMovimiento(${negocio.id})" style="flex:1; background: #17a2b8; color: white; border: none; padding: 5px; border-radius: 3px; cursor: pointer;" title="Mover en el mapa">📍 Mover</button>
                <button onclick="abrirEdicion(${negocio.id})" style="flex:1; background: #ffc107; border: none; padding: 5px; border-radius: 3px; cursor: pointer;">✏️ Editar</button>
                <button onclick="eliminarNegocio(${negocio.id})" style="flex:1; background: #dc3545; color: white; border: none; padding: 5px; border-radius: 3px; cursor: pointer;">🗑️ Borrar</button>
            </div>
        </div>
    `;
    marcador.bindPopup(popupHTML);
}

// 3. Edición y Cancelación
function abrirEdicion(idBuscado) {
    const negocio = listaNegocios.find(n => n.id === idBuscado);
    if (!negocio) return;

    idEdicion = negocio.id; 
    latitudClic = negocio.latitud;
    longitudClic = negocio.longitud;
    urlFotoActual = negocio.foto_url;

    document.getElementById('in_nombre').value = negocio.nombre;
    document.getElementById('in_propietario').value = negocio.propietario;
    document.getElementById('in_rubro').value = negocio.rubro;
    document.getElementById('in_descripcion').value = negocio.descripcion;
    document.getElementById('in_color').value = negocio.color_marcador;
    
    // Configurar checkbox dinámico
    const chkAplicable = document.getElementById('in_aplicable');
    chkAplicable.checked = negocio.aplicable;
    document.getElementById('in_aplicable').checked = negocio.aplicable;

    // Manejar vista de la foto
    document.getElementById('in_foto').value = ''; 
    if (urlFotoActual) {
        document.getElementById('contenedor_foto_actual').style.display = 'block';
    } else {
        document.getElementById('contenedor_foto_actual').style.display = 'none';
    }

    document.getElementById('btn_guardar').innerText = "Actualizar";
    panel.style.display = 'flex';
    map.closePopup();
}

// Función para habilitar el reposicionamiento visual del marcador
function activarMovimiento(id) {
    const marcador = marcadoresDibujados[id];
    if (!marcador) return;

    map.closePopup(); // Cerramos el globo de diálogo
    marcador.dragging.enable(); // Encendemos el motor de arrastre físico
    
    // Cambiamos su apariencia para indicar que está en modo "fantasma"
    marcador.setOpacity(0.6);
    
    // Aviso temporal en pantalla para guiar al usuario
    alert("📍 Modo Movimiento Activado:\nArrastra el icono hasta su nueva posición y suéltalo para guardar los cambios.");

    // Escuchamos el evento exacto en el que el usuario suelta el clic/dedo
    marcador.once('dragend', async function(e) {
        // Apagamos el motor de arrastre y restauramos su color
        marcador.dragging.disable();
        marcador.setOpacity(1);

        // Obtenemos las nuevas coordenadas geográficas
        const nuevaPosicion = e.target.getLatLng();
        
        // Guardamos la nueva posición en Supabase exigiendo los datos de vuelta (.select)
        const { data, error } = await db.from('negocios')
            .update({ latitud: nuevaPosicion.lat, longitud: nuevaPosicion.lng })
            .eq('id', id)
            .select();

        if (error) {
            alert("Error al mover el marcador en la nube.");
            location.reload(); // Revertimos si falla el internet
        } else if (data && data[0]) {
            // El motor en tiempo real redibujará el marcador en su sitio final instantáneamente
            manejarCambioNegocio({ eventType: 'UPDATE', new: data[0] });
        }
    });
}

// Función para eliminar un negocio de la base de datos
async function eliminarNegocio(id) {
    if (confirm("¿Estás seguro de que deseas eliminar este marcador permanentemente?")) {
        await db.from('negocios').delete().eq('id', id);
        map.closePopup();
    }
}

//4. Cerrar panel y limpiar formulario
function cerrarPanel() {
    panel.style.display = 'none';
    idEdicion = null; 
    urlFotoActual = null;
    document.getElementById('btn_guardar').innerText = "Guardar";
    document.getElementById('in_nombre').value = '';
    document.getElementById('in_propietario').value = '';
    document.getElementById('in_descripcion').value = '';
    document.getElementById('in_aplicable').checked = true;
    document.getElementById('in_foto').value = '';
    document.getElementById('contenedor_foto_actual').style.display = 'none';
}

// 5. Descargar los marcadores al iniciar
async function cargarMarcadores() {
    const { data, error } = await db.from('negocios').select('*').eq('dueño_id', usuarioActualId);
    if (!error && data) {
        listaNegocios = data; // Guardamos la lista en memoria
        data.forEach(negocio => dibujarMarcador(negocio));

        // Verificar si teníamos un último visto guardado y si ese negocio aún existe
        if (ultimoVistoId && listaNegocios.find(n => n.id == ultimoVistoId)) {
            document.getElementById('btn_ultimo_visto').style.display = 'block';
        } else {
            // Si el negocio fue eliminado, limpiamos la memoria
            localStorage.removeItem('ultimo_visto_id');
            ultimoVistoId = null;
        }
    }
    // Actualizar el contador predeterminado al cargar la página
        document.getElementById('contador_resultados').innerText = `Total encontrados: ${listaNegocios.length}`;
}

// --- MOTOR DE BÚSQUEDA Y LISTA ---
function filtrarMarcadores() {
    const textoBusqueda = document.getElementById('in_buscar').value.toLowerCase().trim();
    const palabras = textoBusqueda.split(' ').filter(p => p.length > 0); 
    const rubroSeleccionado = document.getElementById('filtro_rubro').value;
    const usarColor = document.getElementById('chk_color').checked;
    const colorSeleccionado = document.getElementById('filtro_color').value;
    const estadoAplicable = document.getElementById('filtro_aplicable').value; // Leemos el nuevo filtro
    
    capaMarcadores.clearLayers();
    marcadoresDibujados = {}; // Limpiamos la memoria
    const listaUL = document.getElementById('lista_resultados');
    listaUL.innerHTML = ''; // Limpiamos la lista visual

    const resultados = listaNegocios.filter(negocio => {
        const contenidoUnido = `${negocio.nombre} ${negocio.rubro} ${negocio.descripcion || ''}`.toLowerCase();
        const coincideTexto = palabras.every(palabra => contenidoUnido.includes(palabra));
        const coincideRubro = (rubroSeleccionado === "") || (negocio.rubro === rubroSeleccionado);
        const coincideColor = (!usarColor) || (negocio.color_marcador === colorSeleccionado);
        
        // Verificamos la coincidencia del estado aplicable
        let coincideAplicable = true;
        if (estadoAplicable === "si") coincideAplicable = (negocio.aplicable === true);
        if (estadoAplicable === "no") coincideAplicable = (negocio.aplicable === false);

        return coincideTexto && coincideRubro && coincideColor && coincideAplicable;
    });
    
    // Actualizar el texto del contador en tiempo real
    document.getElementById('contador_resultados').innerText = `Total encontrados: ${resultados.length}`;
    
    resultados.forEach(negocio => {
        dibujarMarcador(negocio); // Lo dibuja en el mapa
        
        // Lo añade a la lista visual si hay texto escrito
        if (textoBusqueda.length > 0) {
            listaUL.innerHTML += `<li class="item-resultado" onclick="enfocarNegocio(${negocio.id})">📍 <b>${negocio.nombre}</b> - ${negocio.rubro}</li>`;
        }
    });
}

/// Hace zoom con animación hacia un negocio específico, abriendo clústeres si es necesario
function enfocarNegocio(id) {
    // Limpiamos el buscador para que se restauren todos los pines al fondo
    document.getElementById('in_buscar').value = '';
    document.getElementById('lista_resultados').innerHTML = '';
    filtrarMarcadores(); 

    // Buscamos el objeto físico en la memoria
    const marcadorFisico = marcadoresDibujados[id]; 
    
    if (marcadorFisico) {
        // Magia del Clúster: Le pedimos que vuele, separe las burbujas y abra el globo
        capaMarcadores.zoomToShowLayer(marcadorFisico, function() {
            marcadorFisico.openPopup();
        });
    }
}

function irUltimoVisto() {
    if (ultimoVistoId) {
        enfocarNegocio(ultimoVistoId);
    }
}

// --- FASE 3: PERÍMETROS (LÍNEAS MANUALES ABIERTAS Y ELIMINACIÓN) ---

let modoDibujoRuta = false;
let polylineaActual = null; 
let puntosRuta = [];
let perimetrosDibujados = {}; // Memoria para identificar la línea seleccionada
let lineaEnEdicion = null;    // Guarda el objeto físico que estamos modificando
let idPerimetroEnEdicion = null; // Guarda el ID de Supabase
let historialEdicion = []; // Memoria para los pasos de deshacer

// 1. Activar o desactivar el modo de dibujo
function toggleDibujoRuta() {
    modoDibujoRuta = !modoDibujoRuta;
    const btn = document.getElementById('btn_dibujar_ruta');
    
    if (modoDibujoRuta) {
        btn.innerText = "🔴 Cancelar Dibujo";
        btn.style.background = "#ffc107";
        btn.style.color = "black";
        map.getContainer().style.cursor = 'crosshair'; 
    } else {
        btn.innerText = "Activar Dibujo";
        btn.style.background = "#007bff";
        btn.style.color = "white";
        map.getContainer().style.cursor = '';
        limpiarRutaActual();
    }
}

// 2. Evento de Clic en el Mapa (Trazo Directo sin cerrar la figura)
map.on('click', function(e) {

    // BLOQUEO MAESTRO: Si estás presionando Shift, Alt, o acabas de soltar Shift, ignora el clic por completo.
    if (e.originalEvent.shiftKey || e.originalEvent.altKey || estaRotando) return;

    if (modoDibujoRuta) {
        // Guardamos el punto exacto del clic
        puntosRuta.push(e.latlng);
        const colorLinea = document.getElementById('in_color_perimetro').value;

        if (!polylineaActual) {
            // L.polyline dibuja una línea conectando puntos SIN cerrar la figura
            polylineaActual = L.polyline(puntosRuta, {
                color: colorLinea, 
                weight: 6,
                opacity: 0.8
            }).addTo(map);
        } else {
            // Actualizamos la línea recta a recta
            polylineaActual.setLatLngs(puntosRuta);
        }
        
        document.getElementById('btn_guardar_perimetro').style.display = 'block';
        document.getElementById('btn_deshacer_punto').style.display = 'block';
        document.getElementById('btn_limpiar_ruta').style.display = 'block';

    } else {
        // MODO MARCADORES: Abrir formulario normal
        latitudClic = e.latlng.lat;
        longitudClic = e.latlng.lng;
        panel.style.display = 'flex';
    }
});

// 3. Función para Deshacer el último clic
function deshacerUltimoPunto() {
    if (puntosRuta.length > 0) {
        puntosRuta.pop(); // Borramos la última coordenada
        
        if (polylineaActual) {
            polylineaActual.setLatLngs(puntosRuta); // Redibujamos la línea sin ese punto
        }
        
        if (puntosRuta.length === 0) {
            document.getElementById('btn_guardar_perimetro').style.display = 'none';
            document.getElementById('btn_deshacer_punto').style.display = 'none';
            document.getElementById('btn_limpiar_ruta').style.display = 'none';
        }
    }
}

// 4. Limpiar todo el trazo actual
function limpiarRutaActual() {
    if (polylineaActual) {
        map.removeLayer(polylineaActual);
        polylineaActual = null;
    }
    puntosRuta = [];
    document.getElementById('btn_guardar_perimetro').style.display = 'none';
    document.getElementById('btn_deshacer_punto').style.display = 'none';
    document.getElementById('btn_limpiar_ruta').style.display = 'none';
}

// 5. Guardar Perímetro en Supabase
async function guardarPerimetro() {
    if (puntosRuta.length < 2) return alert("Dibuja al menos 2 puntos para crear una línea.");
    const color = document.getElementById('in_color_perimetro').value;
    document.getElementById('btn_guardar_perimetro').innerText = "Guardando...";

    await db.from('perimetros').insert([{ coordenadas: puntosRuta, color_linea: color, dueño_id: usuarioActualId }]);
    
    document.getElementById('btn_guardar_perimetro').innerText = "Guardar Perímetro";
    limpiarRutaActual(); // Borra tu línea de guía azul. El servidor dibujará la oficial.
}

// 6. Descargar los perímetros y hacerlos ELIMINABLES Y EDITABLES
async function cargarPerimetros() {
    const { data, error } = await db.from('perimetros').select('*').eq('dueño_id', usuarioActualId);
    if (!error && data) {
        data.forEach(perimetro => {
            const lineaGuardada = L.polyline(perimetro.coordenadas, {
                color: perimetro.color_linea,
                weight: 6,
                opacity: 0.8
            }).addTo(map);

            // Guardamos la línea en el diccionario usando su ID
            perimetrosDibujados[perimetro.id] = lineaGuardada;

            lineaGuardada.bindPopup(`
                <div style="text-align: center; padding: 5px;">
                    <p style="margin: 0 0 10px 0; font-weight: bold;">Trazado Guardado</p>
                    <button onclick="iniciarEdicionPerimetro(${perimetro.id})" style="background: #ffc107; color: black; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; margin-bottom: 5px; width: 100%; font-weight: bold;">✏️ Editar Puntos</button>
                    <button onclick="eliminarPerimetro(${perimetro.id})" style="background: #dc3545; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; width: 100%;">🗑️ Eliminar</button>
                </div>
            `);
        });
    }
}

// 7. Función para borrar un trazado de la nube
async function eliminarPerimetro(id) {
    if (confirm("¿Estás seguro de que deseas borrar este trazado permanentemente?")) {
        await db.from('perimetros').delete().eq('id', id);
        map.closePopup();
    }
}

// --- NUEVAS FUNCIONES DE EDICIÓN AVANZADA (Geoman) ---
function iniciarEdicionPerimetro(id) {
    const linea = perimetrosDibujados[id];
    if (!linea) return;

    map.closePopup(); 
    linea.pm.enable({ allowSelfIntersection: true, preventMarkerRemoval: false });

    lineaEnEdicion = linea;
    idPerimetroEnEdicion = id;

    // Reiniciamos la memoria y tomamos la primera fotografía
    historialEdicion = [];
    guardarEstadoEdicion();

    // Escuchamos si arrastras, añades o borras (con clic derecho) un vértice
    linea.on('pm:markerdragend', guardarEstadoEdicion);
    linea.on('pm:vertexadded', guardarEstadoEdicion);
    linea.on('pm:vertexremoved', guardarEstadoEdicion);

    document.getElementById('btn_dibujar_ruta').style.display = 'none';
    document.getElementById('btn_guardar_edicion_ruta').style.display = 'block';
    document.getElementById('btn_deshacer_edicion_ruta').style.display = 'block'; // Mostramos Deshacer
    document.getElementById('btn_cancelar_edicion_ruta').style.display = 'block';
    
    estaRotando = true; 
}

async function guardarEdicionPerimetro() {
    if (!lineaEnEdicion || !idPerimetroEnEdicion) return;
    document.getElementById('btn_guardar_edicion_ruta').innerText = "Guardando...";

    const nuevasCoordenadas = lineaEnEdicion.getLatLngs();
    await db.from('perimetros').update({ coordenadas: nuevasCoordenadas }).eq('id', idPerimetroEnEdicion);

    document.getElementById('btn_guardar_edicion_ruta').innerText = "💾 Guardar Edición";
    
    // Apagamos los vértices blancos sin recargar la página
    if (lineaEnEdicion) lineaEnEdicion.pm.disable();
    document.getElementById('btn_guardar_edicion_ruta').style.display = 'none';
    document.getElementById('btn_cancelar_edicion_ruta').style.display = 'none';
    document.getElementById('btn_deshacer_edicion_ruta').style.display = 'none';
    if (lineaEnEdicion) {
        lineaEnEdicion.off('pm:markerdragend', guardarEstadoEdicion);
        lineaEnEdicion.off('pm:vertexadded', guardarEstadoEdicion);
        lineaEnEdicion.off('pm:vertexremoved', guardarEstadoEdicion);
    }
    document.getElementById('btn_dibujar_ruta').style.display = 'block';
    lineaEnEdicion = null;
    idPerimetroEnEdicion = null;
    estaRotando = false;
    map.closePopup();
}

function cancelarEdicionPerimetro() {
    if (lineaEnEdicion) lineaEnEdicion.pm.disable();
    document.getElementById('btn_guardar_edicion_ruta').style.display = 'none';
    document.getElementById('btn_cancelar_edicion_ruta').style.display = 'none';
    document.getElementById('btn_deshacer_edicion_ruta').style.display = 'none';
    if (lineaEnEdicion) {
        lineaEnEdicion.off('pm:markerdragend', guardarEstadoEdicion);
        lineaEnEdicion.off('pm:vertexadded', guardarEstadoEdicion);
        lineaEnEdicion.off('pm:vertexremoved', guardarEstadoEdicion);
    }
    document.getElementById('btn_dibujar_ruta').style.display = 'block';
    lineaEnEdicion = null;
    idPerimetroEnEdicion = null;
    estaRotando = false;

    // Borramos TODOS los trazos físicos de la pantalla y volvemos a descargar la versión original de la base de datos para revertir la línea estirada
    for (let id in perimetrosDibujados) map.removeLayer(perimetrosDibujados[id]);
    perimetrosDibujados = {};
    cargarPerimetros();
}

// Registra silenciosamente cada movimiento que haces en el modo de edición
function guardarEstadoEdicion() {
    if (!lineaEnEdicion) return;
    // Tomamos una "fotografía" exacta de las coordenadas en este milisegundo
    const copia = JSON.parse(JSON.stringify(lineaEnEdicion.getLatLngs()));
    historialEdicion.push(copia);
}

// Hace retroceder la línea al estado anterior
function deshacerEdicion() {
    if (historialEdicion.length > 1) {
        historialEdicion.pop(); // Descartamos el error actual
        const estadoAnterior = historialEdicion[historialEdicion.length - 1]; // Recuperamos el anterior
        
        // Reiniciamos Geoman rápidamente para que reposicione los cuadritos blancos
        lineaEnEdicion.pm.disable();
        lineaEnEdicion.setLatLngs(estadoAnterior);
        lineaEnEdicion.pm.enable({ allowSelfIntersection: true, preventMarkerRemoval: false });
    }
}


// --- HERRAMIENTAS DE PRUEBA ---
async function generarDatosPrueba() {
    const rubros = ["Cafe, Reposteria y Bebidas", "Restaurantes y Gastronomia", "Comida Rapida y Casual", "Bares y Pubs", "Retail y Moda", "Comercio y Markets", "Servicios", "Otros"];
    const colores = ["#ff0000", "#ffff00", "#008000", "#ffa500"];
    
    let nuevosDatos = [];
    
    // Generamos 5 negocios aleatorios cerca del centro de Oruro
    for(let i=1; i<=5; i++) {
        const rubroAleatorio = rubros[Math.floor(Math.random() * rubros.length)];
        nuevosDatos.push({
            nombre: "Negocio Prueba " + Math.floor(Math.random() * 1000),
            propietario: "Dueño " + i,
            rubro: rubroAleatorio,
            descripcion: "Generado automáticamente para pruebas.",
            latitud: -17.9703 + ((Math.random() - 0.5) * 0.03),
            longitud: -67.1123 + ((Math.random() - 0.5) * 0.03),
            aplicable: Math.random() > 0.5,
            forma: mapaRubroIcono[rubroAleatorio], // Automatizado
            color_marcador: colores[Math.floor(Math.random() * colores.length)],
            dueño_id: usuarioActualId // EL DATO CLAVE QUE FALTABA
        });
    }

    // Insertamos y exigimos los datos de vuelta para el dibujo instantáneo
    const { data, error } = await db.from('negocios').insert(nuevosDatos).select();
    
    if (error) {
        alert("Error al generar: " + error.message);
    } else if (data) {
        // Aprovechamos nuestro motor en tiempo real para dibujarlos al instante sin recargar
        data.forEach(negocio => {
            manejarCambioNegocio({ eventType: 'INSERT', new: negocio });
        });
    }
}

// --- HERRAMIENTA GENERAL: BORRAR MIS MARCADORES ---
async function borrarMisMarcadores() {
    if (confirm("⚠️ ADVERTENCIA ⚠️\n¿Estás seguro de querer BORRAR TODOS TUS MARCADORES? Esto no se puede deshacer.")) {
        await db.from('negocios').delete().eq('dueño_id', usuarioActualId);
    }
}

// --- HERRAMIENTAS DE ADMINISTRADOR: GESTIÓN DE USUARIOS ---
async function abrirGestorUsuarios() {
    document.getElementById('modal-usuarios').style.display = 'flex';
    cargarListaUsuarios();
}

let idUsuarioEdicionPanel = null; // Memoria para saber a quién estamos editando

async function cargarListaUsuarios() {
    // Descargamos todos los usuarios de la base de datos
    const { data, error } = await db.from('usuarios').select('*').order('id', { ascending: true });
    if (error) return alert("Error al cargar la lista de usuarios.");

    const lista = document.getElementById('lista_usuarios_admin');
    lista.innerHTML = '';
    
    data.forEach(u => {
        // 1. Botón de Lápiz para TODOS (incluido admin)
        const btnEditar = `<button onclick="prepararEdicionUsuario(${u.id}, '${u.username}', '${u.password}')" style="background: #ffc107; border: none; padding: 5px 8px; border-radius: 4px; cursor: pointer; margin-right: 5px;" title="Editar Usuario">✏️</button>`;
        
        // 2. Botón de Basura SOLO para clientes
        const btnBorrar = u.rol === 'admin' 
            ? `<span style="font-size: 12px; color: #888; margin-left: 5px;">(Admin)</span>` 
            : `<button onclick="eliminarUsuarioBD(${u.id})" style="background: #dc3545; color: white; border: none; padding: 5px 8px; border-radius: 4px; cursor: pointer;" title="Eliminar Usuario">🗑️</button>`;
        
        lista.innerHTML += `
            <li style="display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 1px solid #eee;">
                <div>
                    <b style="font-size: 15px; color: #333;">👤 ${u.username}</b> <br>
                    <span style="font-size: 13px; color: #666;">🔑 Clave: <b>${u.password}</b></span>
                </div>
                <div>
                    ${btnEditar}
                    ${btnBorrar}
                </div>
            </li>
        `;
    });
}

// NUEVA FUNCIÓN: Prepara la caja de arriba para editar en lugar de crear
function prepararEdicionUsuario(id, username, password) {
    idUsuarioEdicionPanel = id;
    document.getElementById('nuevo_user').value = username;
    document.getElementById('nuevo_pass').value = password;
    
    // Transformamos visualmente el botón
    const btn = document.getElementById('btn_guardar_usuario');
    btn.innerText = "Actualizar";
    btn.style.background = "#28a745"; // Se pone verde
}

// FUNCIÓN ACTUALIZADA: Ahora sabe si debe crear uno nuevo o editar uno existente
async function crearNuevoUsuario() {
    const user = document.getElementById('nuevo_user').value.trim();
    const pass = document.getElementById('nuevo_pass').value.trim();
    
    if (!user || !pass) return alert("Por favor, escribe un usuario y una contraseña.");

    if (idUsuarioEdicionPanel) {
        // MODO EDICIÓN: Actualizamos al usuario seleccionado
        const { error } = await db.from('usuarios').update({ username: user, password: pass }).eq('id', idUsuarioEdicionPanel);
        if (error) alert("Error al actualizar. Tal vez ese nombre ya está en uso.");
    } else {
        // MODO CREACIÓN: Insertamos uno nuevo
        const { error } = await db.from('usuarios').insert([{ username: user, password: pass, rol: 'cliente' }]);
        if (error) alert("Error al crear el usuario. Es posible que el nombre ya esté en uso.");
    }
    
    // Limpieza final y vuelta a la normalidad
    idUsuarioEdicionPanel = null;
    document.getElementById('nuevo_user').value = '';
    document.getElementById('nuevo_pass').value = '';
    
    const btn = document.getElementById('btn_guardar_usuario');
    btn.innerText = "+ Añadir";
    btn.style.background = "#007bff"; // Vuelve a azul
    
    cargarListaUsuarios(); // Recarga la lista para ver los cambios
}

async function eliminarUsuarioBD(idUsuarioBuscado) {
    if (confirm("🚨 ¿Estás seguro de eliminar este usuario? Perderá el acceso inmediatamente.")) {
        const { error } = await db.from('usuarios').delete().eq('id', idUsuarioBuscado);
        if (error) alert("Error al eliminar al usuario.");
        else cargarListaUsuarios(); // Recarga la lista para que desaparezca
    }
}

// --- CONTROLES DE TECLADO PARA LA BRÚJULA Y ROTACIÓN ---
let estaRotando = false; // Escudo para bloquear el formulario
let arrastrandoParaRotar = false;
let ratonXInicial = 0;
let anguloInicialMapa = 0;

// 1. Efectos visuales, Reinicio al Norte y Atajos
document.addEventListener('keydown', function(e) {
    // --- NUEVO: Atajo Ctrl + Z para deshacer trazado ---
    if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        if (modoDibujoRuta) {
            e.preventDefault(); 
            deshacerUltimoPunto(); // Para trazados nuevos
        } else if (lineaEnEdicion) {
            e.preventDefault();
            deshacerEdicion();     // Para edición de trazados existentes
        }
        return; 
    }

    // Reinicio de brújula
    if (e.shiftKey && e.altKey) {
        map.setBearing(0); 
        return; 
    }
    
    // Animación de brújula
    if (e.key === 'Shift') {
        const brujula = document.querySelector('.leaflet-control-rotate');
        if (brujula) brujula.classList.add('brujula-activa'); 
    }
});

// 2. MOTOR DE ROTACIÓN MANUAL (Fuerza el giro al arrastrar)
map.on('mousedown', function(e) {
    // Si mantienes presionado Shift al hacer clic...
    if (e.originalEvent.shiftKey) {
        arrastrandoParaRotar = true;
        ratonXInicial = e.originalEvent.clientX; // Guardamos dónde empezaste el clic
        anguloInicialMapa = map.getBearing();    // Guardamos el ángulo actual
        map.dragging.disable();                  // APAGAMOS el desplazamiento normal
    }
});

map.on('mousemove', function(e) {
    // Si estás arrastrando con Shift presionado...
    if (arrastrandoParaRotar) {
        // Calculamos cuánto moviste el ratón a los lados
        let diferenciaX = e.originalEvent.clientX - ratonXInicial;
        
        // Giramos el mapa (0.5 es la sensibilidad, si lo sientes muy rápido bájalo a 0.3)
        map.setBearing(anguloInicialMapa + (diferenciaX * 0.5));
    }
});

map.on('mouseup', function(e) {
    // Al soltar el clic...
    if (arrastrandoParaRotar) {
        arrastrandoParaRotar = false;
        map.dragging.enable(); // ENCENDEMOS el desplazamiento normal otra vez
        
        // Activamos el escudo por medio segundo para que no salte el formulario de registro
        estaRotando = true;
        setTimeout(() => { estaRotando = false; }, 500);
    }
});

// --- FUNCIONES DE INTERFAZ (Ojito y Minimizar) ---

// 1. Alternar visibilidad de contraseña
function togglePassword() {
    const input = document.getElementById('in_pass');
    const icono = document.getElementById('icono_ojo');
    if (input.type === 'password') {
        input.type = 'text';
        icono.innerText = '🙈'; // Cambia el icono cuando es visible
    } else {
        input.type = 'password';
        icono.innerText = '👁️'; // Vuelve al estado original
    }
}

// 2. Colapsar y expandir paneles en celular
function togglePanel(btn) {
    const panel = btn.parentElement; // Seleccionamos la caja entera
    panel.classList.toggle('panel-minimizado'); // Encendemos/apagamos la clase CSS
    
    if (panel.classList.contains('panel-minimizado')) {
        // Si acabamos de minimizarlo, cambiamos el texto y color
        btn.innerText = "🔼 Mostrar Panel";
        btn.style.background = "#007bff";
        btn.style.color = "white";
        btn.style.border = "none";
    } else {
        // Si acabamos de abrirlo, vuelve a la normalidad
        // Revisamos qué texto ponerle según el panel que sea
        if(panel.id === 'panel-buscador') btn.innerText = "🔽 Minimizar Buscador";
        if(panel.id === 'panel-perimetro') btn.innerText = "🔽 Minimizar Trazado";
        if(panel.id === 'panel-admin') btn.innerText = "🔽 Minimizar Admin";
        
        btn.style.background = "#f8f9fa";
        btn.style.color = "#333";
        btn.style.border = "1px solid #ccc";
    }
}

// 3. Auto-minimizar paneles en celular al cargar la página
function autoMinimizarMovil() {
    // Si la pantalla es de celular (950px o menos)
    if (window.innerWidth <= 950) {
        const botones = document.querySelectorAll('.btn-minimizar');
        botones.forEach(btn => {
            const panel = btn.parentElement;
            // Solo lo minimiza si no está minimizado ya
            if (!panel.classList.contains('panel-minimizado')) {
                panel.classList.add('panel-minimizado');
                btn.innerText = "🔼 Mostrar Panel";
                btn.style.background = "#007bff";
                btn.style.color = "white";
                btn.style.border = "none";
            }
        });
    }
}

// --- MOTOR DE TIEMPO REAL (WEB SOCKETS) ---
function iniciarSuscripcionesRealtime() {
    if (!usuarioActualId) return;

    // 1. Canal de Negocios
    db.channel('canal-negocios')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'negocios' }, (payload) => {
            if (payload.eventType === 'DELETE') {
                // Si es un borrado, lo dejamos pasar directamente. La función sabrá si lo tiene en pantalla.
                manejarCambioNegocio(payload);
            } else {
                // Si es crear o editar, verificamos el dueño
                if (payload.new && payload.new.dueño_id === usuarioActualId) manejarCambioNegocio(payload);
            }
        }).subscribe();

    // 2. Canal de Perímetros
    db.channel('canal-perimetros')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'perimetros' }, (payload) => {
            if (payload.eventType === 'DELETE') {
                manejarCambioPerimetro(payload);
            } else {
                if (payload.new && payload.new.dueño_id === usuarioActualId) manejarCambioPerimetro(payload);
            }
        }).subscribe();
}

// Magia silenciosa para Marcadores (Actualizado para Borrado en Tiempo Real)
function manejarCambioNegocio(payload) {
    const { eventType, new: nuevoDato, old: viejoDato } = payload;
    
    if (eventType === 'INSERT') {
        if (nuevoDato.dueño_id == usuarioActualId && !marcadoresDibujados[nuevoDato.id]) {
            listaNegocios.push(nuevoDato);
            dibujarMarcador(nuevoDato);
            filtrarMarcadores();
        }
    } else if (eventType === 'UPDATE') {
        if (nuevoDato.dueño_id == usuarioActualId) {
            const index = listaNegocios.findIndex(n => n.id == nuevoDato.id);
            if (index !== -1) listaNegocios[index] = nuevoDato;
            
            if (marcadoresDibujados[nuevoDato.id]) {
                capaMarcadores.removeLayer(marcadoresDibujados[nuevoDato.id]);
            }
            dibujarMarcador(nuevoDato);
            filtrarMarcadores();
        }
    } else if (eventType === 'DELETE') {
        // Al borrar, Supabase nos envía el ID en viejoDato.id
        const idEliminado = viejoDato.id;
        
        listaNegocios = listaNegocios.filter(n => n.id != idEliminado);
        
        if (marcadoresDibujados[idEliminado]) {
            capaMarcadores.removeLayer(marcadoresDibujados[idEliminado]);
            delete marcadoresDibujados[idEliminado];
        }
        filtrarMarcadores();
    }
}

// Magia silenciosa para Trazados (Actualizado para Borrado en Tiempo Real)
function manejarCambioPerimetro(payload) {
    const { eventType, new: nuevoDato, old: viejoDato } = payload;
    
    if (eventType === 'INSERT') {
         if (nuevoDato.dueño_id == usuarioActualId && !perimetrosDibujados[nuevoDato.id]) {
             dibujarUnPerimetro(nuevoDato);
         }
    } else if (eventType === 'UPDATE') {
         if (nuevoDato.dueño_id == usuarioActualId) {
             if (perimetrosDibujados[nuevoDato.id]) map.removeLayer(perimetrosDibujados[nuevoDato.id]);
             dibujarUnPerimetro(nuevoDato);
         }
    } else if (eventType === 'DELETE') {
        const idEliminado = viejoDato.id;
        
        if (perimetrosDibujados[idEliminado]) {
            map.removeLayer(perimetrosDibujados[idEliminado]);
            delete perimetrosDibujados[idEliminado];
        }
    }
}
// Extraemos la lógica de dibujo para poder reutilizarla
function dibujarUnPerimetro(perimetro) {
    const lineaGuardada = L.polyline(perimetro.coordenadas, { color: perimetro.color_linea, weight: 6, opacity: 0.8 }).addTo(map);
    perimetrosDibujados[perimetro.id] = lineaGuardada;
    lineaGuardada.bindPopup(`
        <div style="text-align: center; padding: 5px;">
            <p style="margin: 0 0 10px 0; font-weight: bold;">Trazado Guardado</p>
            <button onclick="iniciarEdicionPerimetro(${perimetro.id})" style="background: #ffc107; color: black; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; margin-bottom: 5px; width: 100%; font-weight: bold;">✏️ Editar Puntos</button>
            <button onclick="eliminarPerimetro(${perimetro.id})" style="background: #dc3545; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; width: 100%;">🗑️ Eliminar</button>
        </div>
    `);
}

// Reemplazamos tu antigua función cargarPerimetros por esta más moderna
async function cargarPerimetros() {
    const { data, error } = await db.from('perimetros').select('*').eq('dueño_id', usuarioActualId);
    if (!error && data) {
        data.forEach(perimetro => dibujarUnPerimetro(perimetro));
    }
}