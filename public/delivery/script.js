// ============================
// AUTH GUARD
// ============================
if (!localStorage.getItem("token")) {
    window.location.href = "/user/login.html";
}


// ============================
// LOGOUT POPUP
// ============================
const logoutBtn = document.getElementById("logoutBtn");
const logoutConfirmBox = document.getElementById("logoutConfirmBox");
const confirmLogoutYes = document.getElementById("confirmLogoutYes");
const confirmLogoutNo = document.getElementById("confirmLogoutNo");

if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
        logoutConfirmBox.style.display = "flex";
    });

    confirmLogoutNo.addEventListener("click", () => {
        logoutConfirmBox.style.display = "none";
    });

    confirmLogoutYes.addEventListener("click", () => {
        localStorage.clear();
        logoutConfirmBox.style.display = "none";
        window.location.href = "/user/login.html";
    });
}


// ============================
// LOAD READY + ACTIVE ORDERS
// ============================
async function loadReadyOrdersOnHome() {
    const token = localStorage.getItem("token");

    const res = await fetch("/api/order/delivery/ready", {
        headers: {
            "Authorization": "Bearer " + token
        }
    });

    const data = await res.json();
    const availableContainer = document.getElementById("availableOrders");
    const activeContainer = document.getElementById("activeOrders");

    if (!availableContainer || !activeContainer) return;

    if (!data.length) {
        availableContainer.innerHTML = "<p>No ready orders.</p>";
        activeContainer.innerHTML = "<p>No active deliveries.</p>";
        return;
    }

    const readyOrders = data.filter(o => o.status === "ready");
    const activeOrders = data.filter(o => o.status === "out-for-delivery");

    // ---------------- READY ----------------
    if (!readyOrders.length) {
        availableContainer.innerHTML = "<p>No ready orders.</p>";
    } else {
        availableContainer.innerHTML = readyOrders.map(o => `
    <div class="order-card">
        <h3>Order #${o._id}</h3>
        <p><b>Status:</b> ${o.status}</p>
        <p><b>Placed:</b> ${new Date(o.orderedAt).toLocaleString()}</p>

        <p><b>Pharmacy → User:</b> ${o.distancePharmacyToUserKm?.toFixed(2) || 0} km</p>
        <p><b>Expected Earning:</b> ₹${o.expectedEarning?.toFixed(2) || 0}</p>

        <ul>
            ${o.items.map(i =>
                `<li>${i.medicineName} (x${i.quantity})</li>`
            ).join("")}
        </ul>

        <button onclick="acceptDelivery('${o._id}')" class="btn-accept">
            Accept Delivery
        </button>
    </div>
`).join("");

    }

    // ---------------- ACTIVE ----------------
    if (!activeOrders.length) {
  activeContainer.innerHTML = "<p>No active deliveries.</p>";
} else {
  activeContainer.innerHTML = activeOrders.map(o => `
      <div class="order-card">
          <h3>Active Order #${o._id}</h3>
          <p><b>Status:</b> ${o.status}</p>

          <ul>
              ${o.items.map(i =>
                  `<li>${i.medicineName} (x${i.quantity})</li>`
              ).join("")}
          </ul>

          ${
            o.pickedUp
              ? `
                <button onclick="markDelivered('${o._id}')" class="btn-delivered">
                    Mark Delivered ✔
                </button>
              `
              : `
                <button onclick="pickupOrder('${o._id}')" class="btn-accept">
                    Order Pickup
                </button>
              `
          }
      </div>
  `).join("");
}

}


// ============================
// ACCEPT DELIVERY + NAVIGATION
// ============================
async function acceptDelivery(id) {
  const token = localStorage.getItem("token");

  const res = await fetch(`/api/order/delivery/accept/${id}`, {
    method: "PUT",
    headers: {
      "Authorization": "Bearer " + token,
      "Content-Type": "application/json"
    }
  });

  const data = await res.json();

  if (data.error) {
    alert(data.error);
    return;
  }

  // 🌍 Navigate to PHARMACY first
  if (data.pharmacyLocation && typeof data.pharmacyLocation.lat === "number" && typeof data.pharmacyLocation.lon === "number") {
    const { lat, lon } = data.pharmacyLocation;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;
    window.open(url, "_blank");
  } else {
    alert("Order accepted. Proceed to pharmacy.");
  }

  loadReadyOrdersOnHome();
}

async function pickupOrder(id) {
  const token = localStorage.getItem("token");

  const res = await fetch(`/api/order/delivery/pickup/${id}`, {
    method: "PUT",
    headers: {
      "Authorization": "Bearer " + token,
      "Content-Type": "application/json"
    }
  });

  const data = await res.json();

  if (data.error) {
    alert(data.error);
    return;
  }

  // 1) Prefer precise GPS if available
  if (data.userLocation &&
      typeof data.userLocation.lat === "number" &&
      typeof data.userLocation.lon === "number") {

    const { lat, lon } = data.userLocation;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;
    window.open(url, "_blank");

  // 2) Fallback: use address string
  } else if (data.userAddress) {

    const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(data.userAddress)}`;
    window.open(url, "_blank");

  } else {
    alert("Order picked up. Proceed to user location.");
  }

  loadReadyOrdersOnHome();
}





// ============================
// MARK DELIVERED
// ============================
async function markDelivered(id) {
    const token = localStorage.getItem("token");

    await fetch(`/api/order/delivery/delivered/${id}`, {
        method: "PUT",
        headers: {
            "Authorization": "Bearer " + token
        }
    });

    alert("Order delivered!");
    loadReadyOrdersOnHome();
}


// ============================
// EARNINGS DASHBOARD
// ============================
async function loadDeliveryEarnings() {
  const token = localStorage.getItem("token");
  if (!token) return;

  try {
    const res = await fetch("/api/order/history/delivery", {
      headers: { "Authorization": "Bearer " + token }
    });

    const orders = await res.json();
    if (!Array.isArray(orders)) return;

    const today = new Date();
    const todayStr = today.toDateString();

    let todayEarnings = 0;
    let todayDeliveries = 0;
    let weekEarnings = 0;
    let lifetimeEarnings = 0;

    const earningsList = document.getElementById("earningsList");
    if (earningsList) earningsList.innerHTML = "";

    orders.forEach(order => {
      if (order.status !== "delivered") return;

      const deliveredDate = new Date(order.deliveredAt);
      const deliveredStr = deliveredDate.toDateString();

      const earning = Number(order.totalEarning || 0);
      lifetimeEarnings += earning;

      if (deliveredStr === todayStr) {
        todayEarnings += earning;
        todayDeliveries += 1;
      }

      const diffDays = (today - deliveredDate) / (1000 * 60 * 60 * 24);
      if (diffDays <= 7) weekEarnings += earning;

      if (earningsList) {
        const div = document.createElement("div");
        div.className = "earning-card";
        div.innerHTML = `
          <h4>Order ID: ${order._id}</h4>
          <p>Distance: ${order.distanceKm?.toFixed(2) || 0} km</p>
          <p>Base Pay: ₹${order.baseEarning || 0}</p>
          <p>KM Bonus: ₹${order.distanceEarning?.toFixed(2) || 0}</p>
          <p><strong>Total: ₹${order.totalEarning?.toFixed(2) || 0}</strong></p>
          <p>Delivered At: ${deliveredDate.toLocaleString()}</p>
        `;
        earningsList.appendChild(div);
      }
    });

    document.getElementById("todayEarnings").innerText = todayEarnings.toFixed(2);
    document.getElementById("todayDeliveries").innerText = todayDeliveries;
    document.getElementById("weekEarnings").innerText = weekEarnings.toFixed(2);
    document.getElementById("lifetimeEarnings").innerText = lifetimeEarnings.toFixed(2);

  } catch (err) {
    console.error("Failed to load delivery earnings:", err);
  }
}


// ============================
// LIVE DRIVER LOCATION TRACKING
// ============================
function startDeliveryTracking() {
  if (!navigator.geolocation) return;

  setInterval(() => {
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const token = localStorage.getItem("token");
      if (!token) return;

      try {
        await fetch("/api/delivery/update-location", {
          method: "POST",
          headers: {
            "Authorization": "Bearer " + token,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            lat: pos.coords.latitude,
            lon: pos.coords.longitude
          })
        });
      } catch (err) {
        console.error("Delivery location update failed:", err);
      }
    });
  }, 5000);
}


// ============================
// AUTO LOAD
// ============================
document.addEventListener("DOMContentLoaded", () => {
  startDeliveryTracking();

  if (window.location.pathname.includes("earnings")) {
    loadDeliveryEarnings();
  }

  loadReadyOrdersOnHome();
});
