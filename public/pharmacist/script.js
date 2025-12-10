/* ------------------------------
   PHARMACIST PORTAL SCRIPT
------------------------------ */

// 🔒 FRONTEND AUTH GUARD
if (!localStorage.getItem("token")) {
    window.location.href = "/user/login.html";
}


/* ------------------------------
   LOGOUT POPUP
------------------------------ */
const logoutBtn = document.getElementById("logoutBtn");
const logoutConfirmBox = document.getElementById("logoutConfirmBox");
const confirmLogoutYes = document.getElementById("confirmLogoutYes");
const confirmLogoutNo = document.getElementById("confirmLogoutNo");

if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
        logoutConfirmBox.style.display = "flex";
    });

    if (confirmLogoutNo) {
        confirmLogoutNo.addEventListener("click", () => {
            logoutConfirmBox.style.display = "none";
        });
    }

    if (confirmLogoutYes) {
        confirmLogoutYes.addEventListener("click", () => {
            localStorage.clear();
            window.location.href = "/";
        });
    }
}


/* ------------------------------
   ERROR POPUP
------------------------------ */
const errorPopup = document.getElementById("errorPopup");
const errorMessage = document.getElementById("errorMessage");
const errorOk = document.getElementById("errorOk");

function showError(msg) {
    if (errorMessage && errorPopup) {
        errorMessage.textContent = msg;
        errorPopup.style.display = "flex";
    }
}

if (errorOk) {
    errorOk.addEventListener("click", () => {
        errorPopup.style.display = "none";
    });
}


/* ------------------------------
   STATUS BADGE HELPER
------------------------------ */
function statusBadge(status) {
    switch (status) {
        case "pending": return "🕒 Pending";
        case "ready": return "📦 Ready";
        case "out-for-delivery": return "🚚 Out for delivery";
        case "delivered": return "✔️ Delivered";
        case "rejected": return "❌ Rejected";
        default: return status;
    }
}

function formatDate(date) {
    if (!date) return "Unavailable";
    const d = new Date(date);
    return isNaN(d.getTime()) ? "Unavailable" : d.toLocaleString();
}


/* ------------------------------
   LOAD PHARMACY ORDERS
------------------------------ */
async function loadPharmacyOrders() {
    const list = document.getElementById("ordersList");
    if (!list) return;   // ← IMPORTANT FIX

    const token = localStorage.getItem("token");

    const res = await fetch("/api/order/pharmacy", {
        headers: { "Authorization": "Bearer " + token }
    });

    const data = await res.json();

    list.innerHTML =
        data.map(o => `
            <div class="order-card">

                <h3>Order #${o._id}</h3>

                <p><b>Placed:</b> ${formatDate(o.orderedAt || o.createdAt)}</p>

                <ul>
                    ${o.items.map(i => 
                        `<li>${i.medicineName} (x${i.quantity})</li>`
                    ).join("")}
                </ul>

                <p><b>Status:</b> ${statusBadge(o.status)}</p>

                ${o.status === "pending" ? `
                    <button onclick="markStatus('${o._id}', 'ready')" class="btn-ready">
                        Mark Ready
                    </button>
                    <button onclick="markStatus('${o._id}', 'rejected')" class="btn-reject">
                        Reject
                    </button>
                ` : ``}
            </div>
        `).join("");
}


/* ------------------------------
   UPDATE ORDER STATUS
------------------------------ */
async function markStatus(id, status) {
    const token = localStorage.getItem("token");

    const res = await fetch(`/api/order/status/${id}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + token
        },
        body: JSON.stringify({ status })
    });

    const data = await res.json();

    if (data.error) {
        showError(data.error);
        return;
    }

    loadPharmacyOrders();
}


/* ------------------------------
   ADD STOCK (FULLY WORKING)
------------------------------ */
/* ------------------------------
   ADD STOCK
------------------------------ */
async function addStock() {
  const token = localStorage.getItem("token");

  const medicineName = document.getElementById("medicineName")?.value.trim();
  const quantity = parseInt(document.getElementById("quantity")?.value.trim(), 10);
  const batchNo = document.getElementById("batchNo")?.value.trim();
  const price = parseFloat(document.getElementById("price")?.value.trim());
  const image = document.getElementById("image")?.value.trim();

  if (!medicineName || !quantity || !batchNo) {
    showError("Medicine name, quantity and batch number are required.");
    return;
  }

  const body = {
    medicineName,
    quantity,
    batchNo
  };

  if (!isNaN(price)) body.price = price;
  if (image) body.image = image;

  const res = await fetch("/api/stock/add", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + token
    },
    body: JSON.stringify(body)
  });

  const data = await res.json();

  if (data.error) {
    showError(data.error);
    return;
  }

  alert("Stock added successfully!");

  document.getElementById("medicineName").value = "";
  document.getElementById("quantity").value = "";
  document.getElementById("batchNo").value = "";
  document.getElementById("price").value = "";
  document.getElementById("image").value = "";
}



function updateAuthUI() {
    const logoutBtn = document.getElementById("logoutBtn");
    if (!logoutBtn) return;

    const loggedIn = !!localStorage.getItem("token");
    logoutBtn.style.display = loggedIn ? "block" : "none";
}


/* ------------------------------
   INIT ON PAGE LOAD
------------------------------ */
window.addEventListener("DOMContentLoaded", () => {

    updateAuthUI();  // 👈 VERY IMPORTANT

    loadPharmacyOrders();

    const addBtn = document.getElementById("addStockBtn");
    if (addBtn) {
        addBtn.addEventListener("click", addStock);
    }
});