// Variable global para almacenar los datos del JSON
let baseDeDatosPalabras = [];

// Variable global para almacenar el crucigrama generado
let crucigramaActual = null;

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
                
                // Navegación con teclado
                input.addEventListener('input', (e) => {
                    e.target.value = e.target.value.toUpperCase();
                    // Mover al siguiente input
                    const inputs = Array.from(container.querySelectorAll('input'));
                    const currentIndex = inputs.indexOf(e.target);
                    if (currentIndex < inputs.length - 1 && e.target.value) {
                        inputs[currentIndex + 1].focus();
                    }
                });
                
                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Backspace' && !e.target.value) {
                        const inputs = Array.from(container.querySelectorAll('input'));
                        const currentIndex = inputs.indexOf(e.target);
                        if (currentIndex > 0) {
                            inputs[currentIndex - 1].focus();
                        }
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
 * Verifica las respuestas del usuario
 */
function verificarRespuestas() {
    const inputs = document.querySelectorAll('.grid-cell input');
    let correctas = 0;
    let total = inputs.length;
    
    inputs.forEach(input => {
        const celda = input.parentElement;
        const respuestaCorrecta = input.dataset.respuesta;
        const respuestaUsuario = input.value.toUpperCase();
        
        celda.classList.remove('correct', 'incorrect');
        
        if (respuestaUsuario === respuestaCorrecta) {
            celda.classList.add('correct');
            correctas++;
        } else if (respuestaUsuario) {
            celda.classList.add('incorrect');
        }
    });
    
    alert(`¡Has acertado ${correctas} de ${total} letras! (${Math.round(correctas/total*100)}%)`);
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

// Event Listeners
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
    }
});

document.getElementById('verificar-btn').addEventListener('click', verificarRespuestas);
document.getElementById('limpiar-btn').addEventListener('click', limpiarGrid);