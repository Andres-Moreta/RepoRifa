import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, query, where, onSnapshot, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

 
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

// Consulta filtrada: Solo boletos en estado 'reservado'
const q = query(collection(db, "boletos"), where("RIFAEST", "==", "reservado"));

// Escuchar cambios en tiempo real
onSnapshot(q, (snapshot) => {
    tablaReservas.innerHTML = "";

    if (snapshot.empty) {
        tablaReservas.innerHTML = `<tr><td colspan="5" style="text-align:center;">No hay reservas pendientes de pago. ¡Buen trabajo!</td></tr>`;
        return;
    }

    snapshot.forEach((docSnap) => {
        const id = docSnap.id;
        const data = docSnap.data();

        const fila = document.createElement("tr");

        fila.innerHTML = `
            <td><strong>${id}</strong></td>
            <td>${data.RIFANOM}</td>
            <td><a href="https://wa.me/${data.RIFATEL}" target="_blank">${data.RIFATEL}</a></td>
            <td>${data.RIFAVEN || 'General'}</td>
            <td>
                <button class="btn-pagar" data-id="${id}">Confirmar Pago</button>
                <button class="btn-liberar" data-id="${id}">Liberar Número</button>
            </td>
        `;

        tablaReservas.appendChild(fila);
    });

    // Asignar eventos a los botones generados
    agregarEventosBotones();
});

function agregarEventosBotones() {
    // Botones de Confirmar Pago
    document.querySelectorAll(".btn-pagar").forEach(boton => {
        boton.addEventListener("click", async (e) => {
            const id = e.target.getAttribute("data-id");
            if (confirm(`¿Confirmar que el boleto ${id} ya fue pagado?`)) {
                await actualizarEstadoBoleto(id, "pagado");
            }
        });
    });

    // Botones de Liberar Número
    document.querySelectorAll(".btn-liberar").forEach(boton => {
        boton.addEventListener("click", async (e) => {
            const id = e.target.getAttribute("data-id");
            if (confirm(`¿Estás seguro de liberar el boleto ${id}? Se borrarán los datos del comprador.`)) {
                await liberarBoleto(id);
            }
        });
    });
}

// Función para cambiar a estado Pagado (Gris)
async function actualizarEstadoBoleto(id, nuevoEstado) {
    const boletoRef = doc(db, "boletos", id);
    try {
        await updateDoc(boletoRef, {
            RIFAEST: nuevoEstado
        });
    } catch (error) {
        alert("Error al actualizar: " + error);
    }
}

// Función para limpiar los datos y volver a Disponible (Verde)
async function liberarBoleto(id) {
    const boletoRef = doc(db, "boletos", id);
    try {
        await updateDoc(boletoRef, {
            RIFAEST: "disponible",
            RIFANOM: "",
            RIFATEL: "",
            RIFAVEN: "",
            RIFAFEC: null
        });
    } catch (error) {
        alert("Error al liberar: " + error);
    }
}