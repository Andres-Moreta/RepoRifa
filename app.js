// Importar los módulos necesarios de Firebase desde la CDN oficial
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, onSnapshot, doc, runTransaction } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

  // Your web app's Firebase configuration
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

// Escuchar cambios en la base de datos
const boletosRef = collection(db, "boletos");
onSnapshot(boletosRef, (snapshot) => {
    const contenedor = document.getElementById("contenedor-boletos");
    contenedor.innerHTML = ""; 

    const listaBoletos = [];
    snapshot.forEach((doc) => {
        listaBoletos.push({ id: doc.id, ...doc.data() });
    });
    listaBoletos.sort((a, b) => a.id.localeCompare(b.id));

    listaBoletos.forEach((boleto) => {
        const boton = document.createElement("button");
        boton.innerText = boleto.id;
        boton.className = `boleto-btn ${boleto.RIFAEST}`; 
        
        // Si alguien más lo compró y nosotros lo teníamos seleccionado, se quita
        if (boleto.RIFAEST !== "disponible") {
            boton.disabled = true;
            if (numerosSeleccionados.includes(boleto.id)) {
                toggleSeleccion(boleto.id); // Lo sacamos de la lista
            }
        } else {
            // Si está en nuestra lista temporal, le ponemos la clase visual azul
            if (numerosSeleccionados.includes(boleto.id)) {
                boton.classList.add("seleccionado");
            }
            boton.addEventListener("click", () => {
                toggleSeleccion(boleto.id);
            });
        }
        contenedor.appendChild(boton);
    });
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

    // Repintar para reflejar el color azul (esto es rápido, o se actualizará con el onSnapshot)
    const boton = Array.from(document.querySelectorAll('.boleto-btn')).find(b => b.innerText === numeroId);
    if (boton) {
        boton.classList.toggle('seleccionado');
    }
}

// Lógica de compra en bloque
formReserva.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    if (numerosSeleccionados.length === 0) {
        alert("Debes seleccionar al menos un número.");
        return;
    }

    const nombre = document.getElementById("nombre").value;
    const telefono = document.getElementById("telefono").value;
    
    btnGuardar.disabled = true;
    btnGuardar.innerText = "Procesando...";

    try {
        await runTransaction(db, async (transaction) => {
            // 1. Fase de lectura: Leer todos los documentos seleccionados primero
            const referencias = [];
            for (let id of numerosSeleccionados) {
                const ref = doc(db, "boletos", id);
                const docSnap = await transaction.get(ref);
                
                if (!docSnap.exists() || docSnap.data().RIFAEST !== "disponible") {
                    throw `El número ${id} ya no está disponible. Por favor, desmárcalo e intenta de nuevo.`;
                }
                referencias.push(ref);
            }

            // 2. Fase de escritura: Si todos están libres, actualizamos todos de golpe
            for (let ref of referencias) {
                transaction.update(ref, {
                    RIFAEST: "reservado",
                    RIFANOM: nombre,
                    RIFATEL: telefono,
                    RIFAVEN: identificadorVendedor,
                    RIFAFEC: new Date()
                });
            }
        });

        //alert("¡Todos los números fueron reservados con éxito!");
        alert(`¡Números reservados con éxito!\n\nPara completar tu apoyo a esta noble causa.\n Por favor realiza la transferencia o el pago en efectivo a la persona que te compartio el link. \n\n!MUCHAS GRACIAS POR TU APOYO! `);
        
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