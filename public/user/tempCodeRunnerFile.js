/* Robust script.js for multi-page setup
   - Safe checks for missing elements
   - Binds handlers after DOMContentLoaded
   - Preserves search, cart, signup/login, map functions
*/

let map;
let markers = [];
let selectedRole = null;

function el(id) { return document.getElementById(id); }

/* ---------------------------
   NAV + PAGE NAVIGATION
   --------------------------- */
function showPage(id) {
    // Navigate to the separate html file (home.html, cart.html, etc.)
    window.location.href = id + ".html";
}

/* ---------------------------
   SEARCH
   --------------------------- */
async function searchMedicine() {
    const resultsEl = document.getElementById("results");
    const query = document.getElementById("searchBox").value.trim();

    if (!query) {
        resultsEl.innerHTML = "<li>Please enter a search term</li>";
        return;
    }

    try {
        const res = await fetch(`/api/stock/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();

        if (!Array.isArray(data) || data.length === 0) {
            resultsEl.innerHTML = "<li>No medicines found</li>";
            return;
        }

        resultsEl.innerHTML = data.map(item =>
            `<li>
                <b>${escapeHtml(item.medicineName)}</b>
                (Qty: ${item.quantity})
                <button onclick="addToCart('${escapeHtml(item.medicineName)}')">Add</button>
            </li>`
        ).join("");

    } catch (err) {
        console.error("Search Error:", err);
        resultsEl.innerHTML = "<li>Error searching medicines</li>";
    }
}


function goToSearch() {
    const input = el("homeSearchBox");
    const q = input ? input.value.trim() : "";
    window.location.href = `search.html${q ? `?q=${encodeURIComponent(q)}` : ""}`;
}

/* When on search.html, populate query from URL if given */
function initSearchFromQuery() {
    const params = new URLSearchParams(window.location.search);
    if (params.has("q") && el("searchBox")) {
        el("searchBox").value = params.get("q");
        searchMedicine();
    }
}

/* ---------------------------
   CART
   --------------------------- */
async function addToCart(medicineName) {
    const token = localStorage.getItem("token");

    try {
        const res = await fetch("/api/cart/add", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + token
            },
            body: JSON.stringify({
                medicineName,
                quantity: 1
            })
        });

        const data = await res.json();

        if (data.error) {
            alert(data.error);
        } else {
            alert("Added to cart");
        }
    } catch (err) {
        console.error(err);
        alert("Error adding to cart.");
    }
}


async function loadCart() {
    const token = localStorage.getItem("token");

    try {
        const res = await fetch("/api/cart", {
            headers: {
                "Authorization": "Bearer " + token
            }
        });

        const data = await res.json();

        el("cart-items").innerHTML =
            data.length === 0
                ? "<p>Cart is empty</p>"
                : data.map(i => `<li>${i.medicineName} (Qty: ${i.quantity})</li>`).join("");

    } catch (err) {
        console.error(err);
        el("cart-items").innerHTML = "<p>Error loading cart.</p>";
    }
}


/* ---------------------------
   SIGNUP / LOGIN UI
   --------------------------- */
function showLoginForm(role) {
    selectedRole = role;
    const cards = document.querySelector(".login-cards");
    if (cards) cards.style.display = "none";
    const roleSignup = el("roleSignupForm"), roleLogin = el("roleLoginForm");
    if (roleSignup) roleSignup.style.display = "none";
    if (roleLogin) roleLogin.style.display = "block";

    const titles = { user: "User Login", pharmacist: "Pharmacist Login", delivery: "Delivery Partner Login" };
    if (el("roleTitle")) el("roleTitle").innerText = titles[role] || "";
}

function showSignupForm(role) {
    selectedRole = role;
    const cards = document.querySelector(".login-cards");
    if (cards) cards.style.display = "none";
    const roleSignup = el("roleSignupForm"), roleLogin = el("roleLoginForm");
    if (roleLogin) roleLogin.style.display = "none";
    if (roleSignup) roleSignup.style.display = "block";

    const titles = { user: "User Signup", pharmacist: "Pharmacist Signup", delivery: "Delivery Partner Signup" };
    if (el("signupTitle")) el("signupTitle").innerText = titles[role] || "";

    const fields = {
        user: `
            <div class="form-row"><label>Full Name:</label><input id="user-fullname"></div>
            <div class="form-row"><label>Email:</label><input id="user-email" type="email"></div>
            <div class="form-row"><label>Phone:</label><input id="user-phone"></div>
            <div class="form-row"><label>Password:</label><input id="user-password" type="password"></div>
            <div class="form-row"><label>Confirm:</label><input id="user-confirm" type="password"></div>
            <div class="form-row"><label>Address:</label><input id="user-address"></div>
        `,
                pharmacist: `
            <div class="form-row"><label>Pharmacy Name:</label><input id="pharmacy-name"></div>
            <div class="form-row"><label>Pharmacist Name:</label><input id="pharmacist-name"></div>
            <div class="form-row"><label>Email:</label><input id="pharmacist-email" type="email"></div>
            <div class="form-row"><label>Phone:</label><input id="pharmacist-phone"></div>
            <div class="form-row"><label>Password:</label><input id="pharmacist-password" type="password"></div>
            <div class="form-row"><label>License #:</label><input id="license-number"></div>
            <div class="form-row"><label>Address:</label><input id="pharmacy-address"></div>

            <div class="form-row"><label>Latitude:</label>
                <input id="pharmacy-lat" type="number" step="0.000001" placeholder="Auto get...">
            </div>
            <div class="form-row"><label>Longitude:</label>
                <input id="pharmacy-lon" type="number" step="0.000001" placeholder="Auto get...">
            </div>
        `,

        delivery: `
            <div class="form-row"><label>Full Name:</label><input id="delivery-name"></div>
            <div class="form-row"><label>Email:</label><input id="delivery-email" type="email"></div>
            <div class="form-row"><label>Phone:</label><input id="delivery-phone"></div>
            <div class="form-row"><label>Password:</label><input id="delivery-password" type="password"></div>
            <div class="form-row"><label>Vehicle Type:</label>
                <select id="vehicle-type">
                    <option>Bike</option>
                    <option>Scooter</option>
                    <option>Bicycle</option>
                </select>
            </div>
            <div class="form-row"><label>Vehicle Number:</label><input id="vehicle-number"></div>
            <div class="form-row"><label>Area:</label><input id="delivery-area"></div>
        `
    };

        if (el("signupFields")) el("signupFields").innerHTML = fields[role] || "";

    // 🌍 auto-fill location for pharmacist signup
    if (role === "pharmacist") {
      getCurrentLocation().then((loc) => {
        if (!loc) return;
        const latInput = el("pharmacy-lat");
        const lonInput = el("pharmacy-lon");
        if (latInput) latInput.value = loc.lat.toFixed(6);
        if (lonInput) lonInput.value = loc.lon.toFixed(6);
      });
    }
}


async function signupUser() {
  if (!selectedRole) return alert("Select a role first.");

  const payload = { role: selectedRole };

  try {
    if (selectedRole === "user") {
      payload.name = el("user-fullname")?.value || "";
      payload.email = el("user-email")?.value || "";
      payload.phone = el("user-phone")?.value || "";
      payload.password = el("user-password")?.value || "";
      payload.address = el("user-address")?.value || "";

      if (payload.password !== (el("user-confirm")?.value || "")) {
        return alert("Passwords do not match.");
      }

    } else if (selectedRole === "pharmacist") {
      payload.pharmacyName = el("pharmacy-name")?.value || "";
      payload.name = el("pharmacist-name")?.value || "";
      payload.email = el("pharmacist-email")?.value || "";
      payload.phone = el("pharmacist-phone")?.value || "";
      payload.password = el("pharmacist-password")?.value || "";
      payload.license = el("license-number")?.value || "";
      payload.address = el("pharmacy-address")?.value || "";

      const lat = parseFloat(el("pharmacy-lat")?.value);
      const lon = parseFloat(el("pharmacy-lon")?.value);
      if (!isNaN(lat) && !isNaN(lon)) {
        payload.location = { lat, lon };   // 🌍 store pharmacy location
      }

    } else if (selectedRole === "delivery") {
      payload.name = el("delivery-name")?.value || "";
      payload.email = el("delivery-email")?.value || "";
      payload.phone = el("delivery-phone")?.value || "";
      payload.password = el("delivery-password")?.value || "";
      payload.vehicleType = el("vehicle-type")?.value || "";
      payload.vehicleNumber = el("vehicle-number")?.value || "";
      payload.area = el("delivery-area")?.value || "";
    }

    const res = await fetch("http://localhost:5000/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (data.error) return alert(data.error);

    if (data.token) {
      localStorage.setItem("token", data.token);
      alert("Signup Successful!");
      window.location.href = "home.html";
    } else {
      alert("Signup completed.");
      window.location.href = "home.html";
    }
  } catch (err) {
    console.error("Signup error:", err);
    alert("Signup failed.");
  }
}


/* ---------------------------
   LOGIN
   --------------------------- */
async function loginUser() {
  const email = el("loginEmail")?.value || "";
  const password = el("loginPassword")?.value || "";

  if (!selectedRole) {
    showError("Please select a role.");
    return;
  }

  try {
    const location = await getCurrentLocation(); // 🌍 may be null

    const body = { email, password, role: selectedRole };
    if (location && selectedRole === "user") {
      body.location = location;   // update user location on login
    }

    const res = await fetch("http://localhost:5000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    const data = await res.json();
    if (data.error) {
      showError(data.error);
      return;
    }

    if (data.token) {
      localStorage.setItem("token", data.token);
    }

    showLoginSuccess();

    setTimeout(() => {
      if (selectedRole === "pharmacist") {
        window.location.href = "/pharmacist/index.html";
      } else if (selectedRole === "delivery") {
        window.location.href = "/delivery/index.html";
      } else if (selectedRole === "user") {
        window.location.href = "/user/home.html";
      } else {
        window.location.href = "pharmacist/home.html";
      }
    }, 700);

  } catch (err) {
    console.error("Login error:", err);
    showError("Login failed.");
  }
}


function backToRoleCards() {
    selectedRole = null;
    const cards = document.querySelector(".login-cards");
    if (cards) cards.style.display = "flex";
    if (el("roleLoginForm")) el("roleLoginForm").style.display = "none";
    if (el("roleSignupForm")) el("roleSignupForm").style.display = "none";
}

/* ---------------------------
   AUTH UI
   --------------------------- */
function updateAuthUI() {
    const loginBtn = el("loginBtn");
    const logoutBtn = el("logoutBtn");
    if (!loginBtn || !logoutBtn) return;
    const loggedIn = !!localStorage.getItem("token");
    loginBtn.style.display = loggedIn ? "none" : "block";
    logoutBtn.style.display = loggedIn ? "block" : "none";
}

/* ---------------------------
   LOGOUT popup handlers
   --------------------------- */
function logoutUser() {
    const box = el("logoutConfirmBox");
    if (box) box.style.display = "flex";
}

function confirmLogout() {
    localStorage.removeItem("token");
    updateAuthUI();
    const box = el("logoutConfirmBox");
    if (box) box.style.display = "none";
    window.location.href = "home.html";
}

function cancelLogout() {
    const box = el("logoutConfirmBox");
    if (box) box.style.display = "none";
}

/* ---------------------------
   POPUPS
   --------------------------- */
function showLoginSuccess() {
    const box = el("loginSuccessBox");
    if (box) box.style.display = "flex";
}
function hideLoginSuccess() {
    const box = el("loginSuccessBox");
    if (box) box.style.display = "none";
}
function showError(message) {
    if (el("errorMessage")) el("errorMessage").innerText = message;
    const box = el("errorPopup");
    if (box) box.style.display = "flex";
}
function hideError() {
    const box = el("errorPopup");
    if (box) box.style.display = "none";
}

/* ---------------------------
   MAP / PHARMACIES
   --------------------------- */
function initMap(lat, lon) {
    const container = el("map");
    if (!container) return;
    if (!map) {
        map = L.map("map").setView([lat, lon], 14);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
    } else {
        map.setView([lat, lon], 14);
        // if map was hidden earlier, invalidate size
        setTimeout(() => map.invalidateSize(), 200);
    }
}

function addMarker(lat, lon, name) {
    if (!map) return;
    const marker = L.marker([lat, lon]).addTo(map);
    marker.bindPopup(`<b>${escapeHtml(name)}</b>`);
    markers.push(marker);
}

function locatePharmacies() {
    if (!navigator.geolocation) return alert("Geolocation not supported.");

    navigator.geolocation.getCurrentPosition(async pos => {

        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;

        initMap(lat, lon);


                // ⭐ REAL PHARMACY QUERY (properly encoded)
        const query = `[out:json];node["amenity"="pharmacy"](around:2000,${lat},${lon});out;`;
        const url = "https://overpass-api.de/api/interpreter?data=" + encodeURIComponent(query);

        try {
            const res = await fetch(url, {
                method: "GET",
                headers: {
                    "Accept": "application/json"
                }
            });

            const data = await res.json();

            if (!data.elements) {
                alert("No nearby pharmacies found.");
                return;
            }

            data.elements.forEach(pharmacy => {
                addMarker(
                    pharmacy.lat,
                    pharmacy.lon,
                    (pharmacy.tags && pharmacy.tags.name) ? pharmacy.tags.name : "Unnamed Pharmacy"
                );
            });

        } catch (e) {
            console.error("Pharmacy API error:", e);
            alert("Could not load nearby pharmacies.");
        }


    }, () => alert("Location permission denied."));
}


/* ---------------------------
   Helpers
   --------------------------- */
function escapeHtml(str) {
    if (!str) return "";
    return str.replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[c]));
}

/* ---------------------------
   DOMContentLoaded: bind handlers safely
   --------------------------- */
window.addEventListener("DOMContentLoaded", () => {
    // Init search if query present
    initSearchFromQuery();

    // Load cart content if on cart page
    loadCart();

    // Auth UI update
    updateAuthUI();

    // Bind buttons only if present
    if (el("confirmLogoutYes")) el("confirmLogoutYes").onclick = confirmLogout;
    if (el("confirmLogoutNo")) el("confirmLogoutNo").onclick = cancelLogout;
    if (el("loginSuccessOk")) el("loginSuccessOk").onclick = hideLoginSuccess;
    if (el("errorOk")) el("errorOk").onclick = hideError;

    // Bind logout button if present (navbar)
    if (el("logoutBtn")) el("logoutBtn").addEventListener("click", logoutUser);

    // Bind searchBox keyup to searchMedicine (if present)
    if (el("searchBox")) el("searchBox").addEventListener("keyup", () => searchMedicine());

    // If on pharmacies page and map container present, ensure map resizes when page loaded
    if (el("map") && typeof L !== "undefined") {
        // If you want to auto-locate on page load uncomment next line:
        // locatePharmacies();
        setTimeout(() => { if (map) map.invalidateSize(); }, 300);
    }
});


async function searchOnHome() {
  const query = document.getElementById("homeSearchBox").value.trim();
  const resultsEl = document.getElementById("homeResults");

  if (!query) {
    resultsEl.innerHTML = "";
    return;
  }

  try {
    const res = await fetch(`http://localhost:5000/api/stock/search?q=${encodeURIComponent(query)}`);
    const data = await res.json();

    if (!Array.isArray(data) || data.length === 0) {
      resultsEl.innerHTML = "<p>No medicines found</p>";
      return;
    }

    resultsEl.innerHTML = data.map(item => `
      <div class="product-card">
        <img class="product-image" src="${item.image || '/user/default.jpg'}">

        <div class="product-name">${item.medicineName}</div>
        <div class="product-qty">Available: ${item.quantity}</div>

        <button class="product-btn" onclick="addToCart('${item.medicineName}')">
          Add to Cart
        </button>
      </div>
    `).join("");

  } catch (err) {
    console.error("Search Error:", err);
    resultsEl.innerHTML = "<p>Search failed</p>";
  }
}

  


async function placeOrder() {
    const token = localStorage.getItem("token");

    if (!token) {
        alert("Please login first.");
        return;
    }

    try {
        const res = await fetch("/api/order/place", {
            method: "POST",
            headers: {
                "Authorization": "Bearer " + token
            }
        });

        const data = await res.json();

        if (data.error) {
            alert(data.error);
            return;
        }

        alert("Order placed successfully!");

        // Refresh cart
        loadCart();

    } catch (err) {
        console.error("Place order error:", err);
        alert("Failed to place order.");
    }
}

async function placeOrderWithLocation() {
    if (!navigator.geolocation) {
        alert("Geolocation not supported");
        return;
    }

    navigator.geolocation.getCurrentPosition(async (position) => {
        const token = localStorage.getItem("token");

        const body = {
            location: {
                lat: position.coords.latitude,
                lon: position.coords.longitude
            }
        };

        const res = await fetch("/api/order/place", {
            method: "POST",
            headers: {
                "Authorization": "Bearer " + token,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
        });

        const data = await res.json();

        if (data.error) {
            alert(data.error);
        } else {
            alert("Order placed!");
            window.location.href = "/user/home.html";
        }
    });
}

document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("homeSearchBox");

  if (input) {
    input.addEventListener("keyup", () => {
      searchOnHome();   // 🔥 LIVE ELASTICSEARCH SEARCH
    });
  }
});


/* ===========================
   RECENT ORDERS ON HOME PAGE
=========================== */
async function loadRecentOrders() {
  const box = document.getElementById("recentOrders");
  if (!box) return;  // safety

  const token = localStorage.getItem("token");

  if (!token) {
    box.innerHTML = `<p style="text-align:center;color:#777;">Login to see recent orders.</p>`;
    return;
  }

  // Fetch order history
  const res = await fetch("/api/order/history/user", {
    headers: {
      "Authorization": "Bearer " + token
    }
  });

  const data = await res.json();

  box.innerHTML = "";

  if (!Array.isArray(data) || data.length === 0) {
    box.innerHTML = `<p style="text-align:center;color:#777;">No recent orders.</p>`;
    return;
  }

 data.slice(0, 3).forEach(o => {
  const status = o.status || "pending";

  const icon = {
    pending: "⏳",
    ready: "📦",
    "out-for-delivery": "🚚",
    delivered: "✅"
  }[status] || "⏳";

  box.innerHTML += `
    <div class="order-card">
      <div class="order-row">
        <span class="status-chip ${status}">
          ${icon} ${status}
        </span>
      </div>

      <div class="order-items">
        ${o.items.map(i => `<span class="pill">${i.medicineName}</span>`).join("")}
      </div>
    </div>
  `;
});

}

// Get current browser location as Promise
function getCurrentLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude
        });
      },
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  });
}



/* ===========================
   REAL-TIME ORDER UPDATES
=========================== */
let homeSocket = null;

function initHomeSocket() {
  const token = localStorage.getItem("token");
  if (!token) return; // user not logged in

  // Decode token to get user ID (safe client-side trick)
  const payload = JSON.parse(atob(token.split(".")[1]));
  const userId = payload.id;

  // Connect socket
  homeSocket = io("http://172.22.16.1:5000");

  // Listen for user-specific updates
  homeSocket.on("user:ordersChanged", (data) => {
    if (!data || data.userId !== userId) return;

    // 🔥 reload recent orders automatically
    loadRecentOrders();
  });
}

initHomeSocket();
