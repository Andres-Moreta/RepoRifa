import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, onSnapshot, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

const tablaVentas = document.getElementById("tabla-ventas");
const maestroRef = doc(db, "rifa_maestra", "todos_los_boletos");

// Escuchar cambios en el documento maestro
onSnapshot(maestroRef, (docSnap) => {
    tablaVentas.innerHTML = "";

    if (!docSnap.exists()) {
        tablaVentas.innerHTML = `<tr><td colspan="6" style="text-align:center;">Base de datos no encontrada.</td></tr>`;
        return;
    }

    const datos = docSnap.data();
    const ventasAgrupadas = {};

    // 1. Agrupar SOLO los boletos que ya están PAGADOS (Vendidos)
    for (let i = 0; i <= 1000; i++) {
        let numStr = i.toString().padStart(3, '0');
        let boleto = datos[numStr];

        if (boleto && boleto.estado === "pagado") {
            let idOrden = boleto.id_compra || `INDIVIDUAL-${numStr}`;

            if (!ventasAgrupadas[idOrden]) {
                ventasAgrupadas[idOrden] = {
                    boletos: [],
                    comprador: boleto.comprador,
                    telefono: boleto.telefono,
                    vendedor: boleto.vendedor
                };
            }
            ventasAgrupadas[idOrden].boletos.push(numStr);
        }
    }

    // 2. Comprobar si hay ventas para mostrar
    const llavesOrdenes = Object.keys(ventasAgrupadas);
    if (llavesOrdenes.length === 0) {
        tablaVentas.innerHTML = `<tr><td colspan="6" style="text-align:center;">Aún no hay ventas confirmadas.</td></tr>`;
        return;
    }

    // 3. Crear las filas de la tabla
    llavesOrdenes.forEach((idOrden) => {
        const grupo = ventasAgrupadas[idOrden];
        const stringBoletos = grupo.boletos.join(", "); 

        const fila = document.createElement("tr");

        fila.innerHTML = `
            <td><span class="orden-id">${idOrden}</span></td>
            <td><strong class="numeros-grupo">${stringBoletos}</strong></td>
            <td>${grupo.comprador}</td>
            <td>${grupo.telefono}</td>
            <td>${grupo.vendedor || 'General'}</td>
            <td>
                <button class="btn-revertir" data-orden="${idOrden}" data-boletos="${stringBoletos}">
                    Revertir a Reservado
                </button>
            </td>
        `;

        tablaVentas.appendChild(fila);
    });

    agregarEventosBotones();
});

function agregarEventosBotones() {
    // Botones para Revertir a Reservado
    document.querySelectorAll(".btn-revertir").forEach(boton => {
        boton.addEventListener("click", async (e) => {
            const boletosStr = e.target.getAttribute("data-boletos");
            const arrayBoletos = boletosStr.split(", ");
            
            // Confirmación estricta para evitar toques accidentales
            if (confirm(`⚠️ ATENCIÓN: ¿Estás seguro de que deseas regresar los boletos [${boletosStr}] al estado de RESERVA? \n\nDesaparecerán de esta pantalla y volverán al panel de administración normal pendientes de pago.`)) {
                await revertirEstadoMasivo(arrayBoletos, "reservado");
            }
        });
    });
}

// Función que cambia el estado protegiendo los datos del cliente
async function revertirEstadoMasivo(arrayBoletos, nuevoEstado) {
    const datosParaActualizar = {};
    
    arrayBoletos.forEach(num => {
        // Usar notación de punto protege el nombre, teléfono, etc.
        datosParaActualizar[`${num}.estado`] = nuevoEstado;
    });

    try {
        await updateDoc(maestroRef, datosParaActualizar);
        // Firebase recargará la tabla automáticamente gracias al onSnapshot
    } catch (error) {
        alert("Error al revertir el estado: " + error);
    }
}