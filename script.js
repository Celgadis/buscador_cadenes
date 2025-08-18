document.addEventListener('DOMContentLoaded', function () {
    //expresiones regulares para separar rbg, variables, hexadecimales y el resto, en hexadecimales y rgb ignorara el alpha (en el rgb se controla mas adelante)
    const listaRegex = [
        /rgb[^)]+[)]/,
        /\$[^;^ ^!]+/,
        /#[^;^ ^)^,^!]{3,8}/,
        /.{3,}/
    ];
    const ficheros = {};

    //palabras que se buscaran para filtrar
    const palabrasClave = [
        {
            palabra: "color:",
            contador: 0,
            resultados: {}
        },
        {
            palabra: "border:",
            contador: 0,
            resultados: {}
        }];

    //lista con los resultados de de leer y tratar los datos, preparando todo lo necesario para las modificaciones
    const listaResultados = {};

    //evento del fileinput
    document.getElementById('fileInput').addEventListener('change', async (event) => {
        const archivos = Array.from(event.target.files);

        for (const archivo of archivos) {
            await procesarArchivo(archivo);
        }
        await mostrarResultados();
    });



    // Función que lee un archivo y busca las palabras clave línea por línea
    async function procesarArchivo(archivo) {
        const contenido = await leerArchivoComoTexto(archivo);
        ficheros[archivo.name] = contenido; //guarda el fichero para modificarlo despues
        const lineas = contenido.split('\n');

        console.log(`📄 Procesando archivo: ${archivo.name}`);
        let id = 0;
        //revisa el fichero linea a linea
        for (let i = 0; i < lineas.length; i++) {
            const linea = lineas[i];
            //recorremos filtrando por cada palabra clave
            for (const item of palabrasClave) {
                let palabra = item.palabra;
                if (linea.toLowerCase().includes(palabra.toLowerCase())) {
                    let resultado = `[${archivo.name}] Línea ${i + 1}: ${linea}`;
                    item.contador++;
                    let valor = linea.split(":"); //separo la clave y el valor del css
                    valor = valor[1].split("\r"); //quito los retornos de carro
                    valor = valor[0].trim();
                    let coincidencia = null;
                    let regexIndex = 0//llevo el control de que expresion regular se esta evaluando
                    let original = null;
                    let cambiado = null
                    //filtrado a traves de las regex
                    for (const regex of listaRegex) {
                        coincidencia = valor.match(regex)
                        if (coincidencia) {
                            coincidencia = coincidencia[0]
                            if (regexIndex == 0) {//si es un color rgb se convierte a hex
                                original = coincidencia; //guardo el valor de coincidencia original
                                coincidencia = reemplazarRgbPorHexRgb(coincidencia);
                                cambiado = coincidencia; //guardo el valor cambiado a hexadecimal dentro del rgb
                                coincidencia = coincidencia.match(listaRegex[2])[0] //por ultimo guardo solo el hexadecimal que es el que se usara como referencia
                            }
                            if (regexIndex == 2) {//si es hexadecimal convierto a minusculas y expando el valor en caso de que se haya usado la formula corta, para unificar al maximo los resultados
                                original = coincidencia;
                                coincidencia = coincidencia.toLowerCase();
                                coincidencia = expandirHex(coincidencia);
                            }
                            break; //si se ha encontrado la coincidencia ya dejo de revisar las expresiones, solo se necesita la primera coincidencia
                        }
                        regexIndex++
                    }
                    if (!coincidencia) {
                        break; //si no se ha encontrado nada con las expresiones regulares se corta el bucle para no guardar esta linea
                    }
                    //preparamos la clave de orden con valores hsl para poder ver colores similares juntos
                    let regexHex = /^#[0-9A-Fa-f]{3,6}$/;
                    let hsl = coincidencia.match(regexHex) ? hexToHSL(coincidencia) : null

                    let clave = coincidencia
                    let existe = listaResultados.hasOwnProperty(clave);
                    //si no se guardo esta coincidencia se crea, si no solo se aumenta el contador y se guarda la informacion de posicion
                    if (!existe) {
                        listaResultados[clave] = {
                            id: id,
                            valor: coincidencia,
                            contador: 1,
                            coincidencias: [],
                            tipo: regexIndex,
                            hsl: hsl,
                            modificar: false
                        }
                        listaResultados[clave].coincidencias.push({
                            linea: resultado,
                            archivo: archivo.name,
                            pos: i,
                            valor: linea,
                            tipo: regexIndex,
                            coincidencia: coincidencia,
                            original: original,
                            cambiado: cambiado
                        });
                        id++;

                    } else {
                        listaResultados[clave].contador++;
                        listaResultados[clave].coincidencias.push({
                            linea: resultado,
                            archivo: archivo.name,
                            pos: i,
                            valor: linea,
                            tipo: regexIndex,
                            coincidencia: coincidencia,
                            original: original,
                            cambiado: cambiado
                        });
                    }


                }
            }
        }
    }

    /**
     * Función para leer archivo como texto usando FileReader y promesa
     * @param archivo archivo cargado desde el input
     * @return texto del archivo
     **/ 
    function leerArchivoComoTexto(archivo) {
        return new Promise((resolve, reject) => {
            const lector = new FileReader();

            lector.onload = (e) => resolve(e.target.result);
            lector.onerror = (e) => reject(e);

            lector.readAsText(archivo);
        });
    }

    /**
     * 
     * @param  listado objeto que se transformara a texto para descagargar
     * @param  nombre  nombre que tendra el archivo descargado
     */
    async function descargarResultados(listado, nombre) {

        // 1. Convertimos el array en un string
        const contenido = JSON.stringify(listado)

        // 2. Creamos un blob con tipo texto
        const blob = new Blob([contenido], { type: 'text/plain' });

        // 3. Creamos un URL para el blob
        const url = URL.createObjectURL(blob);

        // 4. Creamos un <a> y simulamos un clic
        const enlace = document.createElement('a');
        enlace.href = url;
        enlace.download = nombre;
        document.body.appendChild(enlace);
        enlace.click();

        // 5. Limpiamos
        document.body.removeChild(enlace);
        URL.revokeObjectURL(url);
    }

    /**
     * funcion para convertir colores rgb a rgb con hex
     * @param texto string con la cadena del color rgb a transormar
     * @returns color en formato hexadecimal dentro del rgba se mantendra el alfa si esta especificado
     */
    function reemplazarRgbPorHexRgb(texto) {
        return texto.replace(/rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\s*\)/g,
            (_, r, g, b, a) => {
                const hex =
                    "#" +
                    [r, g, b]
                        .map((x) => parseInt(x).toString(16).padStart(2, "0"))
                        .join("");

                return a !== undefined ? `rgba(${hex}, ${a})` : `rgb(${hex})`;
            });
    }

    /**
     * Muestra los resultados por la web con controles basicos para poder hacer las substituciones
     * al acabar de mostrar, envia para descargar el fichero con los resultados
     */
    async function mostrarResultados() {
        for (const palabra of palabrasClave) {
            const contenedorPalabra = document.querySelector(".palabras ul")
            const node = document.createElement("li")
            node.innerText = `${palabra.palabra} - ${palabra.contador}`
            contenedorPalabra.appendChild(node);
        }
        let total = Object.keys(listaResultados).length
        let totalHsl = 0
        if (total > 1) {
            const contenedorPalabra = document.querySelector(".palabras ul")
            const node = document.createElement("li")
            node.innerText = `colores distintos - ${total}`
            contenedorPalabra.appendChild(node);

        }

        const contenedor = document.querySelector(".resultado");
        const lista = ordenar(listaResultados);
        //por cada resultado se crea una card
        for (const coincidencia of Object.values(lista)) {
            //contador de colos con hsl, son los que se concideraran como verdaderos
            if (coincidencia.hasOwnProperty("hsl") && coincidencia.hsl != null) {
                totalHsl++
            }
            //creacion de las cards
            const card = document.querySelector(".molde .card").cloneNode(true);
            card.dataset.id = coincidencia.valor;
            card.querySelector(".valor").innerText = coincidencia.valor;
            //colorpicker y input
            const picker = card.querySelector(".picker");
            picker.value = coincidencia.valor;

            const hexinput = card.querySelector(".hexcolor");
            hexinput.value = picker.value
            const modificar = card.querySelector(".modificar");
            modificar.dataset.id = coincidencia.valor;

            //eventos del picker y input
            picker.addEventListener("change", () => {
                hexinput.value = picker.value;
                modificar.checked = true;
                modificar.dispatchEvent(new Event("change"));
            })
            hexinput.addEventListener("focusout", () => {
                picker.value = hexinput.value;
                modificar.checked = true;
                modificar.dispatchEvent(new Event("change"));

            })
            modificar.addEventListener("change", () => {
                marcarParaModificar(modificar.dataset.id);
            })


            //rellenamos de informacion la card
            let veces = coincidencia.contador == 1 ? "vez" : "veces";
            card.querySelector(".contador").innerText = `encontrado ${coincidencia.contador} ${veces}`;
            card.querySelector(".muestra").style.backgroundColor = coincidencia.valor

            for (const linea of coincidencia.coincidencias) {
                const nodo = document.createElement("li");
                nodo.innerText = linea.linea
                card.querySelector(".coincidencias").appendChild(nodo);
            }
            contenedor.appendChild(card);
        }
        if (totalHsl > 0) {
            const contenedorPalabra = document.querySelector(".palabras ul")
            const node = document.createElement("li")
            node.innerText = `colores reales - ${totalHsl}`
            contenedorPalabra.appendChild(node);

        }
        //enviamos a descargar el fichero con los resultados
        await descargarResultados(listaResultados, "resultados.json");
    }


    /**
     * ordena los resultados del filtrado por orden de color
     * @param {*} original llistado de resultados obtenidos
     * @returns retorna los resultados ordenados por similitud de color usando hsl como referencia
     */
    function ordenar(original) {
        // Paso 1: Obtener claves y ordenarlas
        const clavesOrdenadas = Object.keys(original).sort((a, b) => {
            const itemA = original[a];
            const itemB = original[b];

            const hslA = itemA.hsl;
            const hslB = itemB.hsl;

            const tieneHslA = hslA && typeof hslA.h === 'number';
            const tieneHslB = hslB && typeof hslB.h === 'number';

            // Priorizar los que tienen HSL
            if (tieneHslA && !tieneHslB) return -1;
            if (!tieneHslA && tieneHslB) return 1;

            // Ambos tienen HSL → ordenar por h, s, l
            if (tieneHslA && tieneHslB) {
                if (hslA.h !== hslB.h) return hslA.h - hslB.h;
                if (hslA.s !== hslB.s) return hslA.s - hslB.s;
                return hslA.l - hslB.l;
            }

            // Ninguno tiene HSL → ordenar alfabéticamente
            return a.localeCompare(b);
        });

        // Paso 2: Reconstruir objeto ordenado
        const objetoOrdenado = {};
        for (const clave of clavesOrdenadas) {
            objetoOrdenado[clave] = original[clave];
        }
        return objetoOrdenado;
    }


    /** 
     *  Función para convertir HEX a HSL
     * @param hex string con el codigo hexadecimal a transformar
    */
    function hexToHSL(hex) {
        // Quitar el # si lo tiene
        hex = hex.replace(/^#/, '');
        if (hex.length === 3) {
            hex = hex.split('').map(c => c + c).join('');
        }
        const r = parseInt(hex.slice(0, 2), 16) / 255;
        const g = parseInt(hex.slice(2, 4), 16) / 255;
        const b = parseInt(hex.slice(4, 6), 16) / 255;

        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;

        if (max === min) {
            h = s = 0; // gris
        } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = ((g - b) / d + (g < b ? 6 : 0)); break;
                case g: h = ((b - r) / d + 2); break;
                case b: h = ((r - g) / d + 4); break;
            }
            h /= 6;
        }
        return { h: h * 360, s, l };
    }

    /**
     * funcion para pasar los hex de 3 caracteres a 6
     * @param {*} hex string con el codigo hexadecimal a tratar
     * @returns string con el codigo hexadecimal del color en formato de 6 caracteres
     */
    function expandirHex(hex) {
        // Asegúrate de que empiece con #
        if (!hex.startsWith("#")) return hex;

        // Eliminar el #
        const cleanHex = hex.slice(1);

        // Si es de 3 caracteres, duplicar cada uno
        if (cleanHex.length === 3) {
            return "#" + cleanHex.split("").map(c => c + c).join("");
        }
        // Si ya es de 6 caracteres, devolver igual
        return hex;
    }


    /**
     * funcion para marcar en el objeto para que se guarde la modificacion del color
     * @param {*} clave clave del objeto a modificar
     */
    function marcarParaModificar(clave) {

        listaResultados[clave].modificar = document.querySelector(`.modificar[data-id="${clave}"]`).checked;
    }


    /**
     * funcion para crear el objeto con las modificaciones a aplicar
     * @returns listado com las modificaciones a aplicar
     */
    async function listaModificados() {
        // Filtrar y copiar solo los que tengan modificar: true
        const soloModificados = [];

        for (const clave in listaResultados) {

            if (listaResultados[clave].modificar === true) {
                for (const coincidencia of listaResultados[clave].coincidencias) {
                    let nuevo;
                    let original
                    let nuevoColor = document.querySelector(`.card[data-id="${clave}"] .hexcolor`).value;
                    if (coincidencia.cambiado) {
                        nuevo = coincidencia.cambiado.replace(coincidencia.coincidencia, nuevoColor);
                    } else {
                        nuevo = nuevoColor
                    }
                    if (coincidencia.original) {
                        original = coincidencia.original;
                    } else {
                        original = coincidencia.valor;
                    }
                    soloModificados.push({
                        archivo: coincidencia.archivo,
                        pos: coincidencia.pos,
                        original: original,
                        nuevo: nuevo
                    })
                }
            }
        }


        let ordenados = soloModificados.sort((a, b) => {
            // Primero comparamos por archivo
            if (a.archivo < b.archivo) return -1;
            if (a.archivo > b.archivo) return 1;

            // Si los archivos son iguales, comparamos por posición
            return a.pos - b.pos;
        });

        await descargarResultados(ordenados, "modificaciones.json");
        return ordenados;
    }

    document.querySelector(".descargar-modificacion").addEventListener("click", async () => {
        const contenidosModificados = await modificarArchivos();
        // 3. Ejemplo: descargar archivos modificados
        for (const nombre in contenidosModificados) {
            const blob = new Blob([contenidosModificados[nombre]], { type: 'text/plain' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = nombre;
            link.click();
        }
    })

    /**
     * funcion para aplicar las modificaciones en los archivos guardados en memoria
     * @returns array con los archivos modificados
     */
    async function modificarArchivos() {
        const modificados = {};
        const datosOrdenados = await listaModificados();
        for (const archivo in ficheros) {

            const lineas = ficheros[archivo].split('\n');

            // Filtramos solo los cambios que aplican a este archivo
            const cambios = datosOrdenados.filter(d => d.archivo === archivo);

            for (const cambio of cambios) {
                const linea = lineas[cambio.pos];

                if (linea && linea.includes(cambio.original)) {
                    lineas[cambio.pos] = linea.replace(cambio.original, cambio.nuevo);
                } else {
                    console.warn(`No se encontró "${cambio.original}" en la línea ${cambio.pos} de ${archivo}`);
                }
            }

            // Guardamos el contenido modificado
            modificados[archivo] = lineas.join('\n');
        }

        return modificados;
    }
})