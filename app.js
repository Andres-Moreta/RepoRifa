// Importar los módulos necesarios de Firebase desde la CDN oficial
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, onSnapshot, doc, runTransaction } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Tu configuración de Firebase
const firebaseConfig = {
    apiKey: "AIzaSyBGNIxiwqaziIrfSKk9s-n51WDoAP9JJZM",
    authDomain: "mirifa-d715f.firebaseapp.com",
    projectId: "mirifa-d715f",
    storageBucket: "mirifa-d715f.firebasestorage.app",
    messagingSenderId: "586254015245",
    appId: "1:586254015245:web:bd333c9d025982b4306e44"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const urlParams = new URLSearchParams(window.location.search);
const identificadorVendedor = urlParams.get('v') || 'general';

// Array para guardar temporalmente los números que el usuario va clickeando
let numerosSeleccionados = [];

// Elementos del DOM
const formReserva = document.getElementById("form-reserva");
const btnGuardar = document.getElementById("btn-guardar");
const contadorNumeros = document.getElementById("contador-numeros");
const listaSeleccionados = document.getElementById("lista-seleccionados");

// NUEVA REFERENCIA: Apuntamos al documento maestro único
const maestroRef = doc(db, "rifa_maestra", "todos_los_boletos");

// Escuchar cambios en la base de datos en TIEMPO REAL sobre un solo documento
onSnapshot(maestroRef, (docSnap) => {
    const contenedor = document.getElementById("contenedor-boletos");
    contenedor.innerHTML = ""; 

    if (!docSnap.exists()) {
        contenedor.innerHTML = "No se encontró la base de datos de la rifa.";
        return;
    }

    // Aquí está nuestro gran diccionario con los 1000 números
    const todosLosNumeros = docSnap.data();

    // Recorremos y creamos los botones del 001 al 1000
    for (let i = 0; i <= 999; i++) {
        let numStr = i.toString().padStart(3, '0');
        let datosBoleto = todosLosNumeros[numStr];

        if (!datosBoleto) continue; // Protección por si falta algún número

        const boton = document.createElement("button");
        boton.innerText = numStr;
        // Usamos la propiedad "estado" que viene de la nueva base de datos
        boton.className = `boleto-btn ${datosBoleto.estado}`; 
        
        // Lógica de botones bloqueados
        if (datosBoleto.estado !== "disponible") {
            boton.disabled = true;
            // Si alguien más lo compró y nosotros lo teníamos seleccionado, se quita automáticamente
            if (numerosSeleccionados.includes(numStr)) {
                toggleSeleccion(numStr); 
            }
        } else {
            // Lógica de botones disponibles
            if (numerosSeleccionados.includes(numStr)) {
                boton.classList.add("seleccionado");
            }
            boton.addEventListener("click", () => {
                toggleSeleccion(numStr);
            });
        }
        contenedor.appendChild(boton);
    }
});

// Función para agregar/quitar números de la lista temporal
function toggleSeleccion(numeroId) {
    const index = numerosSeleccionados.indexOf(numeroId);
    if (index > -1) {
        numerosSeleccionados.splice(index, 1); // Quitar si ya estaba
    } else {
        numerosSeleccionados.push(numeroId); // Agregar si no estaba
    }
    
    // Actualizar los textos y habilitar/deshabilitar el botón de guardar
    contadorNumeros.innerText = numerosSeleccionados.length;
    listaSeleccionados.innerText = numerosSeleccionados.length > 0 ? `Boletos: ${numerosSeleccionados.join(', ')}` : "";
    btnGuardar.disabled = numerosSeleccionados.length === 0;

    // Repintar visualmente el botón seleccionado al instante
    const boton = Array.from(document.querySelectorAll('.boleto-btn')).find(b => b.innerText === numeroId);
    if (boton) {
        boton.classList.toggle('seleccionado');
    }
}

// Lógica de compra agrupada con ID Único
formReserva.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    if (numerosSeleccionados.length === 0) {
        alert("Debes seleccionar al menos un número.");
        return;
    }

    const nombre = document.getElementById("nombre").value.trim();
    const telefono = document.getElementById("telefono").value.trim();
    
    btnGuardar.disabled = true;
    btnGuardar.innerText = "Procesando...";

    // 1. Generamos un código único para esta compra agrupada (Ej: ORD-7A3F)
    const idCompra = "ORD-" + Math.random().toString(36).substring(2, 6).toUpperCase();

    try {
        await runTransaction(db, async (transaction) => {
            // Fase de lectura: Traemos el documento maestro actual
            const maestroDoc = await transaction.get(maestroRef);
            if (!maestroDoc.exists()) {
                throw "Error de conexión con la base de datos.";
            }

            const datosActuales = maestroDoc.data();

            // Verificamos que TODOS los números seleccionados sigan disponibles
            for (let num of numerosSeleccionados) {
                if (datosActuales[num].estado !== "disponible") {
                    throw `El número ${num} fue reservado por otra persona hace un instante. Por favor, desmárcalo e intenta de nuevo.`;
                }
            }

            // Fase de escritura: Preparamos la actualización para inyectar los nuevos datos a los números
            const datosParaActualizar = {};
            const fechaActual = new Date().toISOString();

            for (let num of numerosSeleccionados) {
                // Usamos sintaxis de punto para actualizar solo el objeto de ese número específico
                datosParaActualizar[`${num}`] = {
                    estado: "reservado",
                    comprador: nombre,
                    telefono: telefono,
                    vendedor: identificadorVendedor,
                    fecha_reserva: fechaActual,
                    id_compra: idCompra // Enlazamos todos estos números con el mismo ID
                };
            }

            // Enviamos un solo paquete de actualización a Firebase
            transaction.update(maestroRef, datosParaActualizar);
        });

        // Mensaje de éxito respetando tu texto original, agregando el código de orden
        alert(`¡Números reservados con éxito!\n\nTu código de orden es: ${idCompra}\n\nPara completar tu apoyo a esta noble causa. Por favor realiza la transferencia o el pago en efectivo a la persona que te compartió el link.\n\n¡MUCHAS GRACIAS POR TU APOYO!`);
        
        // Limpiar después del éxito
        numerosSeleccionados = [];
        contadorNumeros.innerText = "0";
        listaSeleccionados.innerText = "";
        formReserva.reset();

    } catch (error) {
        alert("Atención: " + error);
    } finally {
        btnGuardar.innerText = "Guardar y Reservar Números";
        btnGuardar.disabled = numerosSeleccionados.length === 0;
    }
});