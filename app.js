class AnalizadorDevShield {
    constructor(texto, mercado) {
        this.texto = texto.toLowerCase();
        this.banderasRojas = [];
        this.puntajeRiesgo = 0;
        this.mercado = mercado;
        this.salario = null;
    }

    analizarExperiencia() {
        const patrones = [/(\d+)\s*años?\s*de\s*experiencia/, /experiencia\s*(?:mínima\s*)?(?:de\s*)?(\d+)\s*años?/];
        for (const p of patrones) {
            const m = this.texto.match(p);
            if (m) {
                const anos = parseInt(m[1]);
                if (anos >= 2 && (this.texto.includes("junior") || this.texto.includes("trainee"))) {
                    this.banderasRojas.push(`Experiencia oculta: Pide ${anos} años para un perfil "Junior".`);
                    this.puntajeRiesgo += 40;
                }
                break;
            }
        }
    }

    analizarFuncionesCruzadas() {
        const palabrasClave = ["soporte técnico", "mesa de ayuda", "atención al cliente", "soporte n1", "soporte n2"];
        const encontradas = palabrasClave.filter(p => this.texto.includes(p));
        if (encontradas.length > 0) {
            this.banderasRojas.push(`Funciones cruzadas: Incluye ${encontradas.join(", ")}.`);
            this.puntajeRiesgo += 30;
        }
    }

    validarContrato() {
        if (this.texto.includes("a convenir")) {
            this.banderasRojas.push("Salario a convenir: Opacidad en el rango salarial ofertado.");
            this.puntajeRiesgo += 20;
        }
        if (this.texto.includes("prestación de servicios") || this.texto.includes("prestacion de servicios")) {
            this.banderasRojas.push("Contrato sin garantías: Prestación de servicios con posible horario fijo.");
            this.puntajeRiesgo += 25;
        }
    }

    analizarSalario() {
        const m = this.texto.match(/\$?\s?(\d{1,3}(?:[.,]\d{3}){1,2})/);
        if (m) {
            this.salario = parseInt(m[1].replace(/[.,]/g, ""));
            if (this.salario < this.mercado.min) {
                this.banderasRojas.push(`Salario bajo mercado: Ofrece $${this.salario.toLocaleString('es-CO')} COP, por debajo del rango de mercado.`);
                this.puntajeRiesgo += 20;
            }
        }
    }

    ejecutar() {
        this.analizarExperiencia();
        this.analizarFuncionesCruzadas();
        this.validarContrato();
        this.analizarSalario();

        let nivel = "Riesgo Bajo";
        if (this.puntajeRiesgo >= 60) nivel = "Riesgo Alto";
        else if (this.puntajeRiesgo >= 30) nivel = "Riesgo Medio";

        return {
            porcentaje: Math.min(this.puntajeRiesgo, 100),
            nivel: nivel,
            banderas: this.banderasRojas,
            salario: this.salario
        };
    }
}

// Rangos salariales de referencia (editables desde el Panel Administrador)
let roles = [
    { rol: 'Dev Java Junior', min: 2500000, max: 3800000 },
    { rol: 'Dev Frontend Junior', min: 2200000, max: 3500000 },
    { rol: 'QA Tester Junior', min: 2000000, max: 3000000 }
];

function mercadoPromedio() {
    const min = Math.round(roles.reduce((s, r) => s + r.min, 0) / roles.length);
    const max = Math.round(roles.reduce((s, r) => s + r.max, 0) / roles.length);
    return { min, max };
}

document.addEventListener('DOMContentLoaded', () => {
    // Vistas
    const vistas = {
        auth: document.getElementById('vista-auth'),
        analisis: document.getElementById('vista-analisis'),
        resultados: document.getElementById('vista-resultados'),
        admin: document.getElementById('vista-admin')
    };

    // Elementos Nav
    const btnTopRight = document.getElementById('btn-top-right');
    const badgeAdminNav = document.getElementById('badge-admin-nav');

    // Tabs Login/Registro
    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');
    const btnSubmitAuth = document.getElementById('btn-submit-auth');

    // Configuración del botón superior derecho según la vista activa
    const topRightConfig = {
        auth: { label: 'Panel administrador', action: () => mostrarVista('admin') },
        analisis: { label: 'Cerrar sesión', action: () => mostrarVista('auth') },
        resultados: { label: 'Analizar otra', action: () => { document.getElementById('texto-oferta').value = ''; mostrarVista('analisis'); } },
        admin: { label: 'Cerrar sesión', action: () => mostrarVista('auth') }
    };

    // Función para cambiar de vista
    function mostrarVista(nombre) {
        Object.values(vistas).forEach(v => v.classList.add('hidden'));
        vistas[nombre].classList.remove('hidden');

        const cfg = topRightConfig[nombre];
        btnTopRight.innerText = cfg.label;
        btnTopRight.onclick = cfg.action;
        badgeAdminNav.classList.toggle('hidden', nombre !== 'admin');

        if (nombre === 'admin') renderAdminTable();
    }

    // Toggle entre Login y Registro
    tabLogin.addEventListener('click', () => {
        tabLogin.classList.add('active');
        tabRegister.classList.remove('active');
        btnSubmitAuth.innerText = "Iniciar sesión";
    });

    tabRegister.addEventListener('click', () => {
        tabRegister.classList.add('active');
        tabLogin.classList.remove('active');
        btnSubmitAuth.innerText = "Crear cuenta";
    });

    // Evento de Login/Registro -> Redirige al analizador
    btnSubmitAuth.addEventListener('click', () => {
        const email = document.getElementById('auth-email').value;
        if (!email) {
            alert("Por favor ingresa un correo.");
            return;
        }
        mostrarVista('analisis');
    });

    // Ejecutar Análisis
    document.getElementById('btn-analizar').addEventListener('click', () => {
        const texto = document.getElementById('texto-oferta').value;
        if (!texto.trim()) {
            alert("Por favor pega el texto de una oferta laboral para analizar.");
            return;
        }

        const mercado = mercadoPromedio();
        const motor = new AnalizadorDevShield(texto, mercado);
        const resultado = motor.ejecutar();

        document.getElementById('score-porcentaje').innerText = `${resultado.porcentaje}%`;
        document.getElementById('titulo-riesgo').innerText = resultado.nivel;

        const banner = document.getElementById('banner-riesgo');
        const circle = document.getElementById('score-circle');

        let bg, txt, desc, rec;
        if (resultado.nivel === "Riesgo Alto") {
            bg = "var(--risk-high-bg)"; txt = "var(--risk-high-text)";
            desc = "Se detectaron señales de alerta críticas en esta oferta laboral.";
            rec = "Se sugiere cautela antes de aceptar esta oferta. El salario o contrato presentan inconsistencias. Considera negociar o preguntar más detalles al reclutador.";
        } else if (resultado.nivel === "Riesgo Medio") {
            bg = "var(--risk-medium-bg)"; txt = "var(--risk-medium-text)";
            desc = "Se detectaron algunas señales de alerta que conviene revisar antes de postularte.";
            rec = "La oferta tiene algunos puntos a aclarar. Antes de postularte, pregunta directamente sobre las condiciones marcadas como banderas rojas.";
        } else {
            bg = "var(--risk-low-bg)"; txt = "var(--risk-low-text)";
            desc = "La oferta cumple con la mayoría de parámetros de transparencia.";
            rec = "La vacante parece alineada a los estándares de un perfil junior en el mercado.";
        }
        banner.style.backgroundColor = bg;
        circle.style.color = txt;
        document.getElementById('desc-riesgo').innerText = desc;
        document.getElementById('texto-recomendacion').innerText = rec;

        const lista = document.getElementById('lista-banderas');
        lista.innerHTML = "";
        if (resultado.banderas.length === 0) {
            lista.innerHTML = "<li>✅ No se detectaron banderas rojas evidentes.</li>";
        } else {
            resultado.banderas.forEach(b => {
                const li = document.createElement('li');
                li.innerText = `⚠️ ${b}`;
                lista.appendChild(li);
            });
        }

        // Comparación salarial
        document.getElementById('mercado-rango').innerText = `$${mercado.min.toLocaleString('es-CO')} – $${mercado.max.toLocaleString('es-CO')} COP`;
        const salTag = document.getElementById('tag-salario');
        const ofertaSpan = document.getElementById('oferta-salario');
        const pctBar = resultado.salario ? Math.min(100, (resultado.salario / mercado.max) * 100) : 0;
        document.getElementById('barFill').style.width = pctBar + '%';
        document.getElementById('barMarker').style.left = pctBar + '%';

        if (resultado.salario) {
            ofertaSpan.innerText = `$${resultado.salario.toLocaleString('es-CO')} COP`;
            if (resultado.salario < mercado.min) {
                salTag.innerText = 'Por debajo del mínimo de mercado';
                salTag.style.background = 'var(--risk-high-bg)'; salTag.style.color = 'var(--risk-high-text)';
            } else if (resultado.salario > mercado.max) {
                salTag.innerText = 'Por encima del mercado';
                salTag.style.background = 'var(--risk-low-bg)'; salTag.style.color = 'var(--risk-low-text)';
            } else {
                salTag.innerText = 'Dentro del rango de mercado';
                salTag.style.background = 'var(--risk-low-bg)'; salTag.style.color = 'var(--risk-low-text)';
            }
        } else {
            ofertaSpan.innerText = 'No especificado';
            salTag.innerText = 'No se detectó salario en el texto';
            salTag.style.background = '#EDF2F7'; salTag.style.color = '#718096';
        }

        mostrarVista('resultados');
    });

    // Botón Analizar Otra
    document.getElementById('btn-reanalizar').addEventListener('click', () => {
        document.getElementById('texto-oferta').value = "";
        mostrarVista('analisis');
    });

    // Copiar Preguntas
    document.getElementById('btn-copiar-preguntas').addEventListener('click', () => {
        const preguntas = "1. ¿Cuál es el rango salarial exacto asignado para este perfil?\n2. ¿El contrato es a término indefinido o prestación de servicios?\n3. ¿El rol implica tareas de soporte técnico N1/N2 adicionales al desarrollo?";
        navigator.clipboard.writeText(preguntas);
        alert("¡Preguntas sugeridas copiadas al portapapeles!");
    });

    // Panel Admin: renderizar tabla dinámica
    function renderAdminTable() {
        const tbody = document.getElementById('admin-tbody');
        tbody.innerHTML = roles.map((r, i) => `
            <tr data-i="${i}">
                <td class="rol-cell"><strong>${r.rol}</strong></td>
                <td class="min-cell">$${r.min.toLocaleString('es-CO')}</td>
                <td class="max-cell">$${r.max.toLocaleString('es-CO')}</td>
                <td style="text-align:right;"><button class="btn-link" onclick="editarFila(${i})">Editar</button></td>
            </tr>`).join('');
    }

    // Editar una fila del panel admin
    window.editarFila = function (i) {
        const row = document.querySelector(`tr[data-i="${i}"]`);
        const r = roles[i];
        row.querySelector('.rol-cell').innerHTML = `<input type="text" value="${r.rol}" id="edit-rol-${i}">`;
        row.querySelector('.min-cell').innerHTML = `<input type="number" value="${r.min}" id="edit-min-${i}">`;
        row.querySelector('.max-cell').innerHTML = `<input type="number" value="${r.max}" id="edit-max-${i}">`;
        row.querySelector('td:last-child').innerHTML = `<button class="btn-link" onclick="guardarFila(${i})">Guardar</button>`;
    };

    // Guardar una fila editada
    window.guardarFila = function (i) {
        roles[i] = {
            rol: document.getElementById(`edit-rol-${i}`).value,
            min: parseInt(document.getElementById(`edit-min-${i}`).value) || roles[i].min,
            max: parseInt(document.getElementById(`edit-max-${i}`).value) || roles[i].max
        };
        renderAdminTable();
    };

    // Agregar un nuevo rol
    document.getElementById('btn-add-role').addEventListener('click', () => {
        roles.push({ rol: 'Nuevo rol', min: 2000000, max: 3000000 });
        renderAdminTable();
    });

    // Guardar cambios generales del panel admin
    document.getElementById('btn-guardar-admin').addEventListener('click', () => {
        alert('Cambios guardados con éxito. Los nuevos rangos ya se usarán en el próximo análisis.');
    });

    // Vista inicial
    mostrarVista('auth');
});
