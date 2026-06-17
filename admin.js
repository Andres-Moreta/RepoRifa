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

const tablaReservas = document.getElementById("tabla-reservas");
const maestroRef = doc(db, "rifa_maestra", "todos_los_boletos");

// Variable para almacenar los datos en memoria y exportarlos sin gastar lecturas extra
let datosGlobalesRifa = {};

// Escuchar cambios en el documento maestro
onSnapshot(maestroRef, (docSnap) => {
    tablaReservas.innerHTML = "";

    if (!docSnap.exists()) {
        tablaReservas.innerHTML = `<tr><td colspan="6" style="text-align:center;">Base de datos no encontrada.</td></tr>`;
        return;
    }

    const datos = docSnap.data();
    datosGlobalesRifa = datos; // Guardamos foto de la base de datos
    const reservasAgrupadas = {};

    // 1. Agrupar todos los boletos reservados por su ID de Compra (Inicia en 0 para el boleto 000)
    for (let i = 0; i <= 1000; i++) {
        let numStr = i.toString().padStart(3, '0');
        let boleto = datos[numStr];

        if (boleto && boleto.estado === "reservado") {
            let idOrden = boleto.id_compra || `INDIVIDUAL-${numStr}`;

            if (!reservasAgrupadas[idOrden]) {
                reservasAgrupadas[idOrden] = {
                    boletos: [],
                    comprador: boleto.comprador,
                    telefono: boleto.telefono,
                    vendedor: boleto.vendedor
                };
            }
            reservasAgrupadas[idOrden].boletos.push(numStr);
        }
    }

    // 2. Comprobar si hay reservas para mostrar
    const llavesOrdenes = Object.keys(reservasAgrupadas);
    if (llavesOrdenes.length === 0) {
        tablaReservas.innerHTML = `<tr><td colspan="6" style="text-align:center;">No hay reservas pendientes de pago. ¡Buen trabajo!</td></tr>`;
        return;
    }

    // 3. Crear las filas inyectando los datos para WhatsApp en el botón
    llavesOrdenes.forEach((idOrden) => {
        const grupo = reservasAgrupadas[idOrden];
        const stringBoletos = grupo.boletos.join(", "); 

        const fila = document.createElement("tr");

        fila.innerHTML = `
            <td><span class="orden-id">${idOrden}</span></td>
            <td><strong class="numeros-grupo">${stringBoletos}</strong></td>
            <td>${grupo.comprador}</td>
            <td><a href="https://wa.me/593${grupo.telefono.replace(/^0+/, '')}" target="_blank">${grupo.telefono}</a></td>
            <td>${grupo.vendedor || 'General'}</td>
            <td>
                <button class="btn-pagar" 
                    data-orden="${idOrden}" 
                    data-boletos="${stringBoletos}"
                    data-telefono="${grupo.telefono}"
                    data-comprador="${grupo.comprador}">
                    Confirmar Pago
                </button>
                <button class="btn-liberar" data-orden="${idOrden}" data-boletos="${stringBoletos}">Liberar</button>
            </td>
        `;

        tablaReservas.appendChild(fila);
    });

    agregarEventosBotones();
});

function agregarEventosBotones() {
    // Botones de Confirmar Pago Masivo
    document.querySelectorAll(".btn-pagar").forEach(boton => {
        boton.addEventListener("click", async (e) => {
            const boletosStr = e.target.getAttribute("data-boletos");
            const telefonoOrig = e.target.getAttribute("data-telefono");
            const comprador = e.target.getAttribute("data-comprador");
            const arrayBoletos = boletosStr.split(", ");
            
            if (confirm(`¿Confirmar el pago de los boletos: ${boletosStr}?`)) {
                // Ejecutamos la actualización y verificamos si fue exitosa
                const pagoExitoso = await actualizarEstadoMasivo(arrayBoletos, "pagado");
                
                // Si la base de datos se actualizó correctamente, lanzamos WhatsApp
                if (pagoExitoso) {
                    // Formatear teléfono para Ecuador (593)
                    let telefonoWA = "593" + telefonoOrig.replace(/^0+/, '');
                    
                    // Construir el mensaje exacto
                    let mensaje = `¡Hola ${comprador}! Muchas gracias por su apoyo. Confirmamos la compra de sus boletos: ${boletosStr}. Los premios serán de acuerdo a los 3 últimos digitos de las 5 primeras suertes del sorteo de lotería nacional del día 01/07/2026. ¡Mucha suerte!`;
                    
                    // Codificar el texto para que los espacios y símbolos viajen bien en la URL
                    let linkWhatsapp = `https://wa.me/${telefonoWA}?text=${encodeURIComponent(mensaje)}`;
                    
                    // Abrir WhatsApp en una nueva pestaña
                    window.open(linkWhatsapp, '_blank');
                }
            }
        });
    });

    // Botones de Liberar Masivo
    document.querySelectorAll(".btn-liberar").forEach(boton => {
        boton.addEventListener("click", async (e) => {
            const boletosStr = e.target.getAttribute("data-boletos");
            const arrayBoletos = boletosStr.split(", ");
            
            if (confirm(`¿Estás seguro de liberar los boletos: ${boletosStr}? Se borrarán los datos del comprador.`)) {
                await liberarMasivo(arrayBoletos);
            }
        });
    });
}

// Retorna true si fue exitoso, false si falló
async function actualizarEstadoMasivo(arrayBoletos, nuevoEstado) {
    const datosParaActualizar = {};
    arrayBoletos.forEach(num => {
        datosParaActualizar[`${num}.estado`] = nuevoEstado;
    });

    try {
        await updateDoc(maestroRef, datosParaActualizar);
        return true; // Notificamos que todo salió bien
    } catch (error) {
        alert("Error al confirmar pago: " + error);
        return false; // Evitamos abrir WhatsApp si hubo error
    }
}

async function liberarMasivo(arrayBoletos) {
    const datosParaActualizar = {};
    arrayBoletos.forEach(num => {
        datosParaActualizar[num] = { estado: "disponible" };
    });

    try {
        await updateDoc(maestroRef, datosParaActualizar);
    } catch (error) {
        alert("Error al liberar boletos: " + error);
    }
}

// --- LÓGICA: EXPORTAR A EXCEL ---
document.getElementById("btn-exportar").addEventListener("click", () => {
    let csvContent = "Boleto;Estado;Comprador;Teléfono;Vendedor;ID Orden;Fecha de Reserva\n";

    for (let i = 0; i <= 1000; i++) {
        let numStr = i.toString().padStart(3, '0');
        let boleto = datosGlobalesRifa[numStr];

        if (boleto && (boleto.estado === "reservado" || boleto.estado === "pagado")) {
            let comprador = boleto.comprador ? boleto.comprador.replace(/;/g, "") : "";
            let telefono = boleto.telefono || "";
            let vendedor = boleto.vendedor || "General";
            let idCompra = boleto.id_compra || "";
            
            let fecha = "";
            if (boleto.fecha_reserva) {
                let d = new Date(boleto.fecha_reserva);
                fecha = d.toLocaleDateString('es-ES') + " " + d.toLocaleTimeString('es-ES');
            }

            let fila = `"${numStr}";"${boleto.estado.toUpperCase()}";"${comprador}";"${telefono}";"${vendedor}";"${idCompra}";"${fecha}"`;
            csvContent += fila + "\n";
        }
    }

    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.href = url;
    
    const fechaHoy = new Date().toISOString().split('T')[0];
    link.setAttribute("download", `Reporte_Rifa_${fechaHoy}.csv`);
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
});