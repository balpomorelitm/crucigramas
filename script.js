// Variable global para almacenar los datos del JSON
let baseDeDatosPalabras = [];

// Variable global para almacenar el crucigrama generado
let crucigramaActual = null;

// Estado global para controlar la orientación de escritura actual
let estadoEntrada = { palabraIndex: null, orientacion: null };

// Constantes del grid
const GRID_SIZE = 20;
const MAX_INTENTOS = 100;

/**
 * Carga los datos del JSON al iniciar la página
 */
window.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('palabras.json');
        baseDeDatosPalabras = await response.json();
        console.log(`Cargadas ${baseDeDatosPalabras.length} palabras del JSON`);
    } catch (error) {
        console.error('Error al cargar palabras.json:', error);
        alert('Error al cargar el diccionario. Por favor, recarga la página.');
    }
});

/**
 * Filtra las palabras por unidad y calidad
 * @param {string} idUnidad - ID de la unidad (ej: "U5")
 * @returns {Array} - Array de objetos de palabras jugables
 */
function obtenerPalabrasPorUnidad(idUnidad) {
    return baseDeDatosPalabras.filter(item => {
        // Filtrar por unidad
        const lugar = item["Lugar en el libro"] || "";
        if (!lugar.startsWith(idUnidad + " #")) return false;
        
        // Obtener la palabra en español
        const palabra = item["Unidad Léxica (Español)"] || "";
        
        // Verificar que sea jugable:
        // 1. No debe contener espacios
        if (palabra.includes(" ")) return false;
        
        // 2. Debe tener entre 3 y 12 letras
        if (palabra.length < 3 || palabra.length > 12) return false;
        
        // 3. No debe estar toda en mayúsculas (evitar títulos)
        if (palabra === palabra.toUpperCase() && palabra.length > 1) return false;
        
        return true;
    });
}

/**
 * Clase para manejar el grid del crucigrama
 */
class Grid {
    constructor(size) {
        this.size = size;
        this.cells = Array(size).fill(null).map(() => Array(size).fill(null));
    }
    
    esValido(x, y) {
        return x >= 0 && x < this.size && y >= 0 && y < this.size;
    }
    
    obtenerCelda(x, y) {
        if (!this.esValido(x, y)) return null;
        return this.cells[y][x];
    }
    
    establecerCelda(x, y, valor) {
        if (this.esValido(x, y)) {
            this.cells[y][x] = valor;
        }
    }
}

/**
 * Comprueba si una palabra puede colocarse en una posición
 * Esta es la función más compleja: verifica colisiones
 * @param {Grid} grid - El grid del crucigrama
 * @param {string} palabra - La palabra a colocar (en mayúsculas)
 * @param {number} x - Posición X inicial
 * @param {number} y - Posición Y inicial
 * @param {string} orientacion - "horizontal" o "vertical"
 * @param {number} indiceInterseccion - Índice de la letra que intersecta (opcional)
 * @returns {boolean} - true si se puede colocar
 */
function comprobarEspacio(grid, palabra, x, y, orientacion, indiceInterseccion = -1) {
    const dx = orientacion === "horizontal" ? 1 : 0;
    const dy = orientacion === "vertical" ? 1 : 0;
    
    // Verificar que no se salga de los límites
    const finalX = x + dx * (palabra.length - 1);
    const finalY = y + dy * (palabra.length - 1);
    if (!grid.esValido(finalX, finalY)) return false;
    
    // Verificar cada letra de la palabra
    for (let i = 0; i < palabra.length; i++) {
        const currentX = x + dx * i;
        const currentY = y + dy * i;
        const celdaActual = grid.obtenerCelda(currentX, currentY);
        const letraActual = palabra[i];
        
        // Si hay una letra en esta posición
        if (celdaActual !== null) {
            // Debe ser la letra correcta Y debe ser el punto de intersección
            if (i !== indiceInterseccion || celdaActual !== letraActual) {
                return false;
            }
        } else {
            // Si la celda está vacía, verificar que no haya letras adyacentes
            // (excepto en la dirección de la palabra)
            if (orientacion === "horizontal") {
                // Verificar arriba y abajo
                if (grid.obtenerCelda(currentX, currentY - 1) !== null) return false;
                if (grid.obtenerCelda(currentX, currentY + 1) !== null) return false;
            } else {
                // Verificar izquierda y derecha
                if (grid.obtenerCelda(currentX - 1, currentY) !== null) return false;
                if (grid.obtenerCelda(currentX + 1, currentY) !== null) return false;
            }
        }
    }
    
    // Verificar que no haya letras antes del inicio
    const antesX = x - dx;
    const antesY = y - dy;
    if (grid.esValido(antesX, antesY) && grid.obtenerCelda(antesX, antesY) !== null) {
        return false;
    }
    
    // Verificar que no haya letras después del final
    const despuesX = finalX + dx;
    const despuesY = finalY + dy;
    if (grid.esValido(despuesX, despuesY) && grid.obtenerCelda(despuesX, despuesY) !== null) {
        return false;
    }
    
    return true;
}

/**
 * Coloca una palabra en el grid
 * @param {Grid} grid - El grid del crucigrama
 * @param {string} palabra - La palabra a colocar (en mayúsculas)
 * @param {number} x - Posición X inicial
 * @param {number} y - Posición Y inicial
 * @param {string} orientacion - "horizontal" o "vertical"
 */
function colocarPalabra(grid, palabra, x, y, orientacion) {
    const dx = orientacion === "horizontal" ? 1 : 0;
    const dy = orientacion === "vertical" ? 1 : 0;
    
    for (let i = 0; i < palabra.length; i++) {
        const currentX = x + dx * i;
        const currentY = y + dy * i;
        grid.establecerCelda(currentX, currentY, palabra[i]);
    }
}

/**
 * Encuentra posiciones válidas para colocar una palabra que intersecte con una palabra existente
 * @param {Grid} grid - El grid del crucigrama
 * @param {Object} palabraAncla - Objeto con información de la palabra ancla
 * @param {string} nuevaPalabra - La nueva palabra a colocar
 * @param {string} nuevaOrientacion - Orientación de la nueva palabra
 * @returns {Array|null} - [x, y, indiceNuevaPalabra, indiceAncla] o null
 */
function encontrarInterseccion(grid, palabraAncla, nuevaPalabra, nuevaOrientacion) {
    const anclaWord = palabraAncla.palabra;
    const anclaOrientacion = palabraAncla.orientacion;
    
    // Buscar letras comunes
    for (let i = 0; i < nuevaPalabra.length; i++) {
        for (let j = 0; j < anclaWord.length; j++) {
            if (nuevaPalabra[i] === anclaWord[j]) {
                // Calcular la posición donde colocar la nueva palabra
                let nuevoX, nuevoY;
                
                if (anclaOrientacion === "horizontal" && nuevaOrientacion === "vertical") {
                    nuevoX = palabraAncla.x + j;
                    nuevoY = palabraAncla.y - i;
                } else if (anclaOrientacion === "vertical" && nuevaOrientacion === "horizontal") {
                    nuevoX = palabraAncla.x - i;
                    nuevoY = palabraAncla.y + j;
                } else {
                    continue; // Misma orientación, no es válido
                }
                
                // Verificar si se puede colocar
                if (comprobarEspacio(grid, nuevaPalabra, nuevoX, nuevoY, nuevaOrientacion, i)) {
                    return [nuevoX, nuevoY, i, j];
                }
            }
        }
    }
    
    return null;
}

/**
 * Genera un crucigrama completo
 * @param {Array} palabrasDisponibles - Array de objetos de palabras
 * @param {number} numPalabras - Número de palabras a colocar
 * @returns {Object} - {grid, palabrasColocadas}
 */
function generarCrucigrama(palabrasDisponibles, numPalabras) {
    if (palabrasDisponibles.length === 0) {
        alert('No hay palabras disponibles para esta unidad.');
        return null;
    }
    
    const grid = new Grid(GRID_SIZE);
    const palabrasColocadas = [];
    const palabrasUsadas = new Set();
    
    // Mezclar las palabras disponibles
    const palabrasMezcladas = [...palabrasDisponibles].sort(() => Math.random() - 0.5);
    
    // Colocar la primera palabra horizontalmente en el centro
    const primeraPalabra = palabrasMezcladas[0];
    const palabraUpper = primeraPalabra["Unidad Léxica (Español)"].toUpperCase();
    const startX = Math.floor((GRID_SIZE - palabraUpper.length) / 2);
    const startY = Math.floor(GRID_SIZE / 2);
    
    colocarPalabra(grid, palabraUpper, startX, startY, "horizontal");
    palabrasColocadas.push({
        palabra: palabraUpper,
        x: startX,
        y: startY,
        orientacion: "horizontal",
        pista: primeraPalabra["Traducción (Inglés)"] || primeraPalabra["Unidad Léxica (Español)"]
    });
    palabrasUsadas.add(primeraPalabra["Unidad Léxica (Español)"].toLowerCase());
    
    // Intentar colocar más palabras
    let palabrasColocadasCount = 1;
    let intentos = 0;
    
    while (palabrasColocadasCount < numPalabras && intentos < MAX_INTENTOS) {
        intentos++;
        
        // Elegir una palabra ancla aleatoria
        const anclaIndex = Math.floor(Math.random() * palabrasColocadas.length);
        const palabraAncla = palabrasColocadas[anclaIndex];
        
        // Elegir una nueva palabra que no hayamos usado
        let nuevaPalabraObj = null;
        for (let i = 0; i < palabrasMezcladas.length; i++) {
            const candidata = palabrasMezcladas[i];
            const palabraKey = candidata["Unidad Léxica (Español)"].toLowerCase();
            if (!palabrasUsadas.has(palabraKey)) {
                nuevaPalabraObj = candidata;
                break;
            }
        }
        
        if (!nuevaPalabraObj) break; // No hay más palabras disponibles
        
        const nuevaPalabra = nuevaPalabraObj["Unidad Léxica (Español)"].toUpperCase();
        const nuevaOrientacion = palabraAncla.orientacion === "horizontal" ? "vertical" : "horizontal";
        
        // Intentar encontrar una intersección
        const interseccion = encontrarInterseccion(grid, palabraAncla, nuevaPalabra, nuevaOrientacion);
        
        if (interseccion) {
            const [nuevoX, nuevoY] = interseccion;
            colocarPalabra(grid, nuevaPalabra, nuevoX, nuevoY, nuevaOrientacion);
            palabrasColocadas.push({
                palabra: nuevaPalabra,
                x: nuevoX,
                y: nuevoY,
                orientacion: nuevaOrientacion,
                pista: nuevaPalabraObj["Traducción (Inglés)"] || nuevaPalabraObj["Unidad Léxica (Español)"]
            });
            palabrasUsadas.add(nuevaPalabraObj["Unidad Léxica (Español)"].toLowerCase());
            palabrasColocadasCount++;
            intentos = 0; // Resetear intentos después de un éxito
        }
    }
    
    console.log(`Crucigrama generado con ${palabrasColocadasCount} palabras`);
    return { grid, palabrasColocadas };
}

/**
 * Dibuja el grid en el HTML
 * @param {Grid} grid - El grid del crucigrama
 * @param {Array} palabrasColocadas - Array de palabras colocadas
 */
function dibujarGrid(grid, palabrasColocadas) {
    const container = document.getElementById('grid-container');
    container.innerHTML = '';

    // Resetear el estado de escritura actual al redibujar el grid
    estadoEntrada = { palabraIndex: null, orientacion: null };

    // Crear un mapa de celdas y las palabras a las que pertenecen
    const cellWordsMap = new Map();
    palabrasColocadas.forEach((palabraInfo, palabraIndex) => {
        const dx = palabraInfo.orientacion === 'horizontal' ? 1 : 0;
        const dy = palabraInfo.orientacion === 'vertical' ? 1 : 0;
        for (let i = 0; i < palabraInfo.palabra.length; i++) {
            const cellX = palabraInfo.x + dx * i;
            const cellY = palabraInfo.y + dy * i;
            const key = `${cellX},${cellY}`;
            if (!cellWordsMap.has(key)) {
                cellWordsMap.set(key, []);
            }
            cellWordsMap.get(key).push({
                palabraIndex,
                orientacion: palabraInfo.orientacion,
                letraIndex: i
            });
        }
    });
    
    // Encontrar los límites del grid usado
    let minX = GRID_SIZE, maxX = 0, minY = GRID_SIZE, maxY = 0;
    for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
            if (grid.obtenerCelda(x, y) !== null) {
                minX = Math.min(minX, x);
                maxX = Math.max(maxX, x);
                minY = Math.min(minY, y);
                maxY = Math.max(maxY, y);
            }
        }
    }
    
    // Añadir margen
    minX = Math.max(0, minX - 1);
    maxX = Math.min(GRID_SIZE - 1, maxX + 1);
    minY = Math.max(0, minY - 1);
    maxY = Math.min(GRID_SIZE - 1, maxY + 1);
    
    const anchoGrid = maxX - minX + 1;
    const altoGrid = maxY - minY + 1;
    
    // Configurar el grid CSS
    container.style.gridTemplateColumns = `repeat(${anchoGrid}, 40px)`;
    container.style.gridTemplateRows = `repeat(${altoGrid}, 40px)`;
    
    // Crear mapas para números
    const numerosMap = new Map();
    let numeroActual = 1;
    
    // Asignar números a las palabras (ordenadas por posición)
    const palabrasOrdenadas = [...palabrasColocadas].sort((a, b) => {
        if (a.y !== b.y) return a.y - b.y;
        return a.x - b.x;
    });
    
    palabrasOrdenadas.forEach(palabra => {
        const key = `${palabra.x},${palabra.y}`;
        if (!numerosMap.has(key)) {
            numerosMap.set(key, numeroActual);
            palabra.numero = numeroActual;
            numeroActual++;
        } else {
            palabra.numero = numerosMap.get(key);
        }
    });
    
    // Dibujar el grid
    for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
            const celda = grid.obtenerCelda(x, y);
            const div = document.createElement('div');
            div.className = 'grid-cell';
            div.dataset.x = x;
            div.dataset.y = y;
            
            if (celda !== null) {
                const input = document.createElement('input');
                input.type = 'text';
                input.maxLength = 1;
                input.dataset.respuesta = celda;
                const key = `${x},${y}`;
                input.dataset.words = JSON.stringify(cellWordsMap.get(key) || []);

                // Navegación con teclado
                input.addEventListener('focus', (e) => {
                    seleccionarPalabraDesdeInput(e.target);
                });

                input.addEventListener('input', (e) => {
                    e.target.value = e.target.value.toUpperCase();
                    seleccionarPalabraDesdeInput(e.target);
                    if (e.target.value) {
                        moverEnPalabra(e.target, 1);
                    }
                });

                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Backspace' && !e.target.value) {
                        seleccionarPalabraDesdeInput(e.target);
                        moverEnPalabra(e.target, -1);
                    }
                });

                div.appendChild(input);
                
                // Añadir número si es el inicio de una palabra
                const key = `${x},${y}`;
                if (numerosMap.has(key)) {
                    const numeroDiv = document.createElement('div');
                    numeroDiv.className = 'cell-number';
                    numeroDiv.textContent = numerosMap.get(key);
                    div.appendChild(numeroDiv);
                }
            } else {
                div.classList.add('empty');
            }
            
            container.appendChild(div);
        }
    }
    
    // Dibujar las pistas
    dibujarPistas(palabrasColocadas);
}

/**
 * Determina la palabra activa basada en el input seleccionado.
 * @param {HTMLInputElement} input - Input que está activo.
 * @param {string|null} orientacionPreferida - Orientación a priorizar.
 */
function seleccionarPalabraDesdeInput(input, orientacionPreferida = null) {
    const data = input.dataset.words ? JSON.parse(input.dataset.words) : [];
    if (!data.length) {
        estadoEntrada = { palabraIndex: null, orientacion: null };
        return;
    }

    let seleccion = null;

    if (orientacionPreferida) {
        seleccion = data.find(item => item.orientacion === orientacionPreferida) || null;
    }

    if (!seleccion && estadoEntrada.palabraIndex !== null) {
        seleccion = data.find(item => item.palabraIndex === estadoEntrada.palabraIndex) || null;
    }

    if (!seleccion) {
        seleccion = data[0];
    }

    estadoEntrada = {
        palabraIndex: seleccion.palabraIndex,
        orientacion: seleccion.orientacion
    };
}

/**
 * Mueve el foco dentro de la palabra activa siguiendo su orientación.
 * @param {HTMLInputElement} input - Input de referencia.
 * @param {number} paso - Dirección del movimiento (1 siguiente, -1 anterior).
 */
function moverEnPalabra(input, paso) {
    if (!crucigramaActual) return;

    const { palabraIndex, orientacion } = estadoEntrada;
    if (palabraIndex === null || orientacion === null) return;

    const palabraInfo = crucigramaActual.palabrasColocadas[palabraIndex];
    if (!palabraInfo) return;

    const data = input.dataset.words ? JSON.parse(input.dataset.words) : [];
    const datosCelda = data.find(item => item.palabraIndex === palabraIndex);
    if (!datosCelda) return;

    const nuevaPosicion = datosCelda.letraIndex + paso;
    if (nuevaPosicion < 0 || nuevaPosicion >= palabraInfo.palabra.length) return;

    const dx = orientacion === 'horizontal' ? 1 : 0;
    const dy = orientacion === 'vertical' ? 1 : 0;
    const nextX = palabraInfo.x + dx * nuevaPosicion;
    const nextY = palabraInfo.y + dy * nuevaPosicion;
    const container = document.getElementById('grid-container');
    const siguienteInput = container.querySelector(`.grid-cell[data-x="${nextX}"][data-y="${nextY}"] input`);

    if (siguienteInput) {
        siguienteInput.focus();
        seleccionarPalabraDesdeInput(siguienteInput, orientacion);
    }
}

/**
 * Dibuja las pistas en el HTML
 * @param {Array} palabrasColocadas - Array de palabras colocadas
 */
function dibujarPistas(palabrasColocadas) {
    const horizontales = document.getElementById('pistas-horizontales');
    const verticales = document.getElementById('pistas-verticales');
    
    horizontales.innerHTML = '';
    verticales.innerHTML = '';
    
    // Ordenar palabras por número
    const palabrasOrdenadas = [...palabrasColocadas].sort((a, b) => a.numero - b.numero);
    
    palabrasOrdenadas.forEach(palabra => {
        const li = document.createElement('li');
        li.value = palabra.numero;
        li.textContent = palabra.pista;
        
        if (palabra.orientacion === 'horizontal') {
            horizontales.appendChild(li);
        } else {
            verticales.appendChild(li);
        }
    });
}

/**
 * Limpia el grid
 */
function limpiarGrid() {
    const inputs = document.querySelectorAll('.grid-cell input');
    inputs.forEach(input => {
        input.value = '';
        input.parentElement.classList.remove('correct', 'incorrect');
    });
}

/**
 * Crea efecto de confeti para celebrar
 */
function crearConfeti(elemento) {
    const rect = elemento.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const colors = ['#667eea', '#764ba2', '#10b981', '#f093fb', '#f5576c'];

    for (let i = 0; i < 12; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti-piece';
        confetti.style.left = centerX + 'px';
        confetti.style.top = centerY + 'px';
        confetti.style.background = colors[Math.floor(Math.random() * colors.length)];

        const angle = (Math.PI * 2 * i) / 12;
        const velocity = 50 + Math.random() * 50;
        const tx = Math.cos(angle) * velocity;
        const ty = Math.sin(angle) * velocity - 100;

        confetti.style.setProperty('--tx', tx + 'px');
        confetti.style.setProperty('--ty', ty + 'px');

        document.body.appendChild(confetti);

        setTimeout(() => confetti.remove(), 1000);
    }
}

/**
 * Verifica si una palabra completa está correcta
 */
function verificarPalabraCompleta(palabraInfo) {
    const { palabra, x, y, orientacion } = palabraInfo;
    const dx = orientacion === 'horizontal' ? 1 : 0;
    const dy = orientacion === 'vertical' ? 1 : 0;

    let todasCorrectas = true;
    const celdas = [];

    for (let i = 0; i < palabra.length; i++) {
        const currentX = x + dx * i;
        const currentY = y + dy * i;
        const celda = document.querySelector(`.grid-cell[data-x="${currentX}"][data-y="${currentY}"]`);
        const input = celda?.querySelector('input');

        if (!input || input.value.toUpperCase() !== palabra[i]) {
            todasCorrectas = false;
            break;
        }
        celdas.push(celda);
    }

    return { todasCorrectas, celdas };
}

/**
 * Anima una palabra completada correctamente
 */
function animarPalabraCorrecta(celdas) {
    celdas.forEach((celda, index) => {
        setTimeout(() => {
            celda.style.animation = 'none';
            setTimeout(() => {
                celda.style.animation = '';
                celda.classList.add('correct');

                // Confeti solo en la primera y última letra
                if (index === 0 || index === celdas.length - 1) {
                    crearConfeti(celda);
                }
            }, 10);
        }, index * 80);
    });

    // Sonido de éxito (puedes añadir un audio)
    setTimeout(() => {
        const gridContainer = document.getElementById('grid-container');
        gridContainer.classList.add('success-animation');
        setTimeout(() => gridContainer.classList.remove('success-animation'), 800);
    }, celdas.length * 80);
}

/**
 * Verifica las respuestas del usuario con animaciones mejoradas
 */
function verificarRespuestas() {
    if (!crucigramaActual) {
        alert('Primero genera un crucigrama');
        return;
    }

    const inputs = document.querySelectorAll('.grid-cell input');
    let correctas = 0;
    let total = inputs.length;
    let palabrasCompletasCorrectas = 0;

    // Limpiar clases anteriores
    inputs.forEach(input => {
        input.parentElement.classList.remove('correct', 'incorrect');
    });

    // Verificar cada letra primero
    inputs.forEach(input => {
        const celda = input.parentElement;
        const respuestaCorrecta = input.dataset.respuesta;
        const respuestaUsuario = input.value.toUpperCase();

        if (respuestaUsuario === respuestaCorrecta) {
            correctas++;
        } else if (respuestaUsuario) {
            celda.classList.add('incorrect');
        }
    });

    // Verificar palabras completas
    crucigramaActual.palabrasColocadas.forEach((palabraInfo, index) => {
        setTimeout(() => {
            const { todasCorrectas, celdas } = verificarPalabraCompleta(palabraInfo);
            if (todasCorrectas) {
                palabrasCompletasCorrectas++;
                animarPalabraCorrecta(celdas);
            }
        }, index * 100);
    });

    // Mostrar resultados con delay para que se vean las animaciones
    setTimeout(() => {
        const porcentaje = Math.round((correctas / total) * 100);
        const mensaje = porcentaje === 100
            ? `🎉 ¡PERFECTO! Has completado el crucigrama correctamente.\n${palabrasCompletasCorrectas} palabras de ${crucigramaActual.palabrasColocadas.length}`
            : `Has acertado ${correctas} de ${total} letras (${porcentaje}%)\n${palabrasCompletasCorrectas} palabras completas de ${crucigramaActual.palabrasColocadas.length}`;

        alert(mensaje);

        if (porcentaje === 100) {
            celebrarVictoria();
        }
    }, crucigramaActual.palabrasColocadas.length * 100 + 500);
}

/**
 * Celebración especial cuando se completa todo el crucigrama
 */
function celebrarVictoria() {
    const container = document.querySelector('.container');
    container.style.animation = 'none';
    setTimeout(() => {
        container.style.animation = '';

        // Confeti masivo
        for (let i = 0; i < 50; i++) {
            setTimeout(() => {
                const x = Math.random() * window.innerWidth;
                const y = Math.random() * window.innerHeight;
                const fakeElement = document.createElement('div');
                fakeElement.style.position = 'fixed';
                fakeElement.style.left = x + 'px';
                fakeElement.style.top = y + 'px';
                document.body.appendChild(fakeElement);
                crearConfeti(fakeElement);
                setTimeout(() => fakeElement.remove(), 100);
            }, i * 30);
        }
    }, 10);
}

/**
 * Verifica automáticamente mientras el usuario escribe
 */
function configurarVerificacionAutomatica() {
    const container = document.getElementById('grid-container');
    container.addEventListener('input', (e) => {
        if (e.target.tagName === 'INPUT' && crucigramaActual) {
            const input = e.target;
            const celda = input.parentElement;
            const x = parseInt(celda.dataset.x);
            const y = parseInt(celda.dataset.y);

            // Verificar si esta letra completa alguna palabra
            setTimeout(() => {
                crucigramaActual.palabrasColocadas.forEach(palabraInfo => {
                    const { todasCorrectas, celdas } = verificarPalabraCompleta(palabraInfo);
                    if (todasCorrectas && !celdas[0].classList.contains('correct')) {
                        animarPalabraCorrecta(celdas);
                    }
                });
            }, 100);
        }
    });
}

// Actualizar el event listener de generar para incluir verificación automática
const generarBtn = document.getElementById('generar-btn');
const oldListener = generarBtn.onclick;
document.getElementById('generar-btn').addEventListener('click', () => {
    const palabras = obtenerPalabrasPorUnidad('U5');
    console.log(`Palabras disponibles para U5: ${palabras.length}`);

    if (palabras.length === 0) {
        alert('No se encontraron palabras para la Unidad 5.');
        return;
    }

    crucigramaActual = generarCrucigrama(palabras, 10);

    if (crucigramaActual) {
        dibujarGrid(crucigramaActual.grid, crucigramaActual.palabrasColocadas);
        configurarVerificacionAutomatica();
    }
});

document.getElementById('verificar-btn').addEventListener('click', verificarRespuestas);
document.getElementById('limpiar-btn').addEventListener('click', limpiarGrid);
