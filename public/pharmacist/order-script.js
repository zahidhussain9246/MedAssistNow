async function loadOrders() {
    const token = localStorage.getItem("token");

    const res = await fetch("/api/order/pharmacy", {
        headers: {
            "Authorization": "Bearer " + token
        }
    });

    const orders = await res.json();
    const container = document.getElementById("orderContainer");

    if (!orders.length) {
        container.innerHTML = "<p>No orders yet.</p>";
        return;
    }

    container.innerHTML = orders.map(o => `
        <div class="order-card">

            <div class="order-header">
                <h3>Order #${o._id}</h3>
                <span class="status ${o.status}">${o.status}</span>
            </div>

            <p><b>Placed:</b> ${new Date(o.createdAt).toLocaleString()}</p>

            <ul class="item-list">
                ${o.items.map(i =>
                    `<li>${i.medicineName} (x${i.quantity})</li>`
                ).join("")}
            </ul>

            <div class="action-row">
                <button onclick="updateOrder('${o._id}', 'ready')" class="btn-ready">Mark Ready</button>
                <button onclick="updateOrder('${o._id}', 'rejected')" class="btn-reject">Reject</button>
            </div>

        </div>
    `).join("");
}


async function updateOrder(id, status) {
    const token = localStorage.getItem("token");

    await fetch(`/api/order/status/${id}`, {
        method: "PUT",
        headers: {
            "Authorization": "Bearer " + token,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ status })
    });

    loadOrders(); // refresh
}

window.addEventListener("DOMContentLoaded", loadOrders);
