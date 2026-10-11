(() => {
  const config = window.SHOP_CONFIG;
  const authScreen = document.querySelector("#auth-screen");
  const appScreen = document.querySelector("#app-screen");
  const authForm = document.querySelector("#auth-form");
  const authMessage = document.querySelector("#auth-message");
  const orderMessage = document.querySelector("#order-message");
  const orderForm = document.querySelector("#order-form");
  const menuList = document.querySelector("#menu-list");
  const ordersList = document.querySelector("#orders-list");
  const productList = document.querySelector("#product-list");
  const toast = document.querySelector("#toast");
  const receiptDialog = document.querySelector("#receipt-dialog");
  const receiptContent = document.querySelector("#receipt-content");
  const productDialog = document.querySelector("#product-dialog");
  const productForm = document.querySelector("#product-form");
  const productMessage = document.querySelector("#product-message");
  let supabaseClient;
  let products = [];
  let manageableProducts = [];
  let dailyOrders = [];
  let toastTimer;
  let signingUp = false;
  let currentUser;

  const money = (value) => new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: config.currency || "USD"
  }).format(Number(value || 0));

  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);

  const setMessage = (element, text, success = false) => {
    element.textContent = text;
    element.classList.toggle("success", success);
  };

  const showToast = (text) => {
    toast.textContent = text;
    toast.classList.remove("hidden");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.add("hidden"), 3500);
  };

  const showApp = async (user) => {
    currentUser = user;
    authScreen.classList.add("hidden");
    appScreen.classList.remove("hidden");
    document.querySelector("#user-email").textContent = user.email || "";
    document.querySelector("#today-label").textContent = new Intl.DateTimeFormat(undefined, {
      weekday: "long", month: "long", day: "numeric"
    }).format(new Date()).toUpperCase();
    try {
      const { error } = await supabaseClient.rpc("seed_default_products");
      if (error) throw error;
      await loadDashboard();
    } catch (error) {
      showToast(`Could not initialize the menu: ${error.message}`);
    }
  };

  const showAuth = () => {
    appScreen.classList.add("hidden");
    authScreen.classList.remove("hidden");
  };

  const loadProducts = async () => {
    const { data, error } = await supabaseClient
      .from("products")
      .select("id,name,price,cost,active")
      .order("name");
    if (error) throw error;
    const allProducts = data || [];
    manageableProducts = allProducts;
    products = allProducts.filter((product) => product.active);
    menuList.innerHTML = products.map((product) => `
      <label class="menu-row">
        <span class="menu-name">${escapeHtml(product.name)}</span>
        <span class="menu-price">${money(product.price)}</span>
        <input class="quantity-input" type="number" min="0" max="100" step="1" value="0"
          data-product-id="${escapeHtml(product.id)}" aria-label="Quantity for ${escapeHtml(product.name)}" />
      </label>
    `).join("");
    productList.innerHTML = allProducts.map((product) => `
      <article class="product-row">
        <div class="product-details">
          <strong>${escapeHtml(product.name)}</strong>
          <span>Selling ${money(product.price)} · Cost ${money(product.cost)}</span>
        </div>
        <span class="product-status${product.active ? "" : " inactive"}">${product.active ? "Active" : "Hidden"}</span>
        <div class="product-actions">
          <button class="text-button edit-product" type="button" data-product-id="${escapeHtml(product.id)}">Edit</button>
          <button class="text-button toggle-product" type="button" data-product-id="${escapeHtml(product.id)}"
            data-active="${product.active}">${product.active ? "Hide" : "Show"}</button>
        </div>
      </article>
    `).join("");
    document.querySelector("#empty-products").classList.toggle("hidden", allProducts.length > 0);
    updateTotal();
  };

  const updateTotal = () => {
    const total = [...menuList.querySelectorAll(".quantity-input")].reduce((sum, input) => {
      const quantity = Math.max(0, Number.parseInt(input.value, 10) || 0);
      const product = products.find((item) => item.id === input.dataset.productId);
      return sum + (product ? Number(product.price) * quantity : 0);
    }, 0);
    document.querySelector("#bill-total").textContent = money(total);
  };

  const localDayRange = () => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { start: start.toISOString(), end: end.toISOString() };
  };

  const loadDashboard = async () => {
    try {
      const { start, end } = localDayRange();
      const { data, error } = await supabaseClient
        .from("orders")
        .select("id,created_at,total,total_cost,order_items(name,quantity,unit_price,unit_cost)")
        .gte("created_at", start)
        .lt("created_at", end)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const orders = data || [];
      dailyOrders = orders;
      const revenue = orders.reduce((sum, order) => sum + Number(order.total), 0);
      const profit = orders.reduce((sum, order) => sum + Number(order.total) - Number(order.total_cost), 0);
      document.querySelector("#summary-orders").textContent = String(orders.length);
      document.querySelector("#summary-revenue").textContent = money(revenue);
      document.querySelector("#summary-profit").textContent = money(profit);
      document.querySelector("#summary-margin").textContent = `${revenue ? (profit / revenue * 100).toFixed(1) : "0"}%`;
      document.querySelector("#orders-count").textContent = String(orders.length);
      document.querySelector("#empty-orders").classList.toggle("hidden", orders.length > 0);
      ordersList.innerHTML = orders.map((order, index) => {
        const time = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(order.created_at));
        return `<article class="order-item">
          <span class="order-number">ORDER ${String(orders.length - index).padStart(3, "0")}</span>
          <time class="order-time" datetime="${escapeHtml(order.created_at)}">${time}</time>
          <span class="order-value">${money(order.total)}</span>
          <button class="text-button view-bill" type="button" data-order-id="${escapeHtml(order.id)}"
            aria-label="View bill ${String(orders.length - index).padStart(3, "0")}">View bill</button>
        </article>`;
      }).join("");
      await loadProducts();
    } catch (error) {
      showToast(`Could not load shop data: ${error.message}`);
    }
  };

  const renderReceipt = (order, orderNumber) => {
    const date = new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium", timeStyle: "short"
    }).format(new Date(order.created_at));
    const lines = (order.order_items || []).map((item) => `
      <div class="receipt-line">
        <span>${escapeHtml(item.name)} × ${Number(item.quantity)}</span>
        <span>${money(Number(item.unit_price) * Number(item.quantity))}</span>
      </div>`).join("");
    receiptContent.innerHTML = `
      <div class="receipt-head">
        <div class="brand-lockup"><span class="brand-mark">C</span><span>COUNTERTOP</span></div>
        <h2>Thank you!</h2><p>Your order is confirmed.</p>
      </div>
      <div class="receipt-meta"><span>Bill #${String(orderNumber).padStart(3, "0")}</span><span>${escapeHtml(date)}</span></div>
      ${lines}
      <div class="receipt-total"><span>Total</span><span>${money(order.total)}</span></div>
      <p class="receipt-thanks">We appreciate your visit.</p>`;
    receiptDialog.showModal();
  };

  const setAuthMode = () => {
    document.querySelector("#auth-title").textContent = signingUp ? "Create your account" : "Welcome back";
    document.querySelector("#auth-submit").textContent = signingUp ? "Create account" : "Sign in";
    document.querySelector("#auth-switch-copy").textContent = signingUp ? "Already have an account?" : "New to Countertop?";
    document.querySelector("#auth-switch").textContent = signingUp ? "Sign in" : "Create an account";
    setMessage(authMessage, "");
  };

  if (!window.supabase || !config || config.supabaseUrl.includes("YOUR-PROJECT") ||
      config.supabaseAnonKey.includes("YOUR_SUPABASE")) {
    setMessage(authMessage, "Set your Supabase URL and anon key in config.js before signing in.");
    document.querySelector("#auth-submit").disabled = true;
    document.querySelector("#auth-switch").disabled = true;
    return;
  }

  supabaseClient = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
  supabaseClient.auth.getSession().then(({ data, error }) => {
    if (error) setMessage(authMessage, error.message);
    else if (data.session) showApp(data.session.user);
  });
  supabaseClient.auth.onAuthStateChange((_event, session) => {
    if (session) showApp(session.user);
    else showAuth();
  });

  document.querySelector("#auth-switch").addEventListener("click", () => {
    signingUp = !signingUp;
    setAuthMode();
  });

  authForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = document.querySelector("#auth-submit");
    button.disabled = true;
    setMessage(authMessage, "");
    const form = new FormData(authForm);
    const email = String(form.get("email")).trim();
    const password = String(form.get("password"));
    try {
      if (signingUp) {
        const { data, error } = await supabaseClient.auth.signUp({ email, password });
        if (error) throw error;
        if (data.session) showApp(data.session.user);
        else setMessage(authMessage, "Account created. Check your email to confirm it, then sign in.", true);
      } else {
        const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (error) {
      setMessage(authMessage, error.message);
    } finally {
      button.disabled = false;
    }
  });

  document.querySelector("#sign-out").addEventListener("click", async () => {
    const { error } = await supabaseClient.auth.signOut();
    if (error) showToast(`Could not sign out: ${error.message}`);
  });

  document.querySelector("#refresh").addEventListener("click", loadDashboard);
  menuList.addEventListener("input", updateTotal);

  const openProductDialog = (product) => {
    productForm.reset();
    document.querySelector("#product-id").value = product ? product.id : "";
    document.querySelector("#product-name").value = product ? product.name : "";
    document.querySelector("#product-price").value = product ? product.price : "";
    document.querySelector("#product-cost").value = product ? product.cost : "";
    document.querySelector("#product-dialog-title").textContent = product ? "Edit item" : "Add item";
    document.querySelector("#save-product").textContent = product ? "Save changes" : "Save item";
    setMessage(productMessage, "");
    productDialog.showModal();
  };

  document.querySelector("#add-product").addEventListener("click", () => openProductDialog());
  document.querySelector("#cancel-product").addEventListener("click", () => productDialog.close());

  productForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const saveButton = document.querySelector("#save-product");
    const productId = document.querySelector("#product-id").value;
    const payload = {
      name: document.querySelector("#product-name").value.trim(),
      price: Number(document.querySelector("#product-price").value),
      cost: Number(document.querySelector("#product-cost").value)
    };
    if (!payload.name || !Number.isFinite(payload.price) || payload.price < 0 ||
        !Number.isFinite(payload.cost) || payload.cost < 0) {
      setMessage(productMessage, "Enter an item name and valid non-negative prices.");
      return;
    }
    saveButton.disabled = true;
    setMessage(productMessage, "");
    try {
      const query = productId
        ? supabaseClient.from("products").update(payload).eq("id", productId)
        : supabaseClient.from("products").insert({ ...payload, owner_id: currentUser.id });
      const { error } = await query;
      if (error) throw error;
      productDialog.close();
      await loadDashboard();
      showToast(productId ? "Menu item updated." : "Menu item added.");
    } catch (error) {
      setMessage(productMessage, `Could not save item: ${error.message}`);
    } finally {
      saveButton.disabled = false;
    }
  });

  productList.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-product-id]");
    if (!button) return;
    const managedProduct = manageableProducts.find((item) => item.id === button.dataset.productId);
    if (!managedProduct) {
      showToast("Could not find that menu item. Refresh and try again.");
      return;
    }
    if (button.classList.contains("edit-product")) {
      openProductDialog(managedProduct);
      return;
    }
    const { error } = await supabaseClient
      .from("products")
      .update({ active: !managedProduct.active })
      .eq("id", managedProduct.id);
    if (error) {
      showToast(`Could not update menu item: ${error.message}`);
      return;
    }
    await loadDashboard();
    showToast(managedProduct.active ? "Item hidden from new bills." : "Item added back to new bills.");
  });

  document.querySelector("#export-orders").addEventListener("click", () => {
    if (!dailyOrders.length) {
      showToast("There are no bills to download for today.");
      return;
    }
    const csvCell = (value) => {
      let text = String(value ?? "");
      if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
      return `"${text.replace(/"/g, '""')}"`;
    };
    const rows = [["Bill", "Date and time", "Item", "Quantity", "Unit price", "Line total", "Bill total", "Bill profit"]];
    dailyOrders.forEach((order, index) => {
      const billNumber = `Bill ${String(dailyOrders.length - index).padStart(3, "0")}`;
      const timestamp = new Intl.DateTimeFormat(undefined, {
        dateStyle: "short", timeStyle: "short"
      }).format(new Date(order.created_at));
      (order.order_items || []).forEach((item) => rows.push([
        billNumber,
        timestamp,
        item.name,
        item.quantity,
        Number(item.unit_price).toFixed(2),
        (Number(item.unit_price) * Number(item.quantity)).toFixed(2),
        Number(order.total).toFixed(2),
        (Number(order.total) - Number(order.total_cost)).toFixed(2)
      ]));
    });
    const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    const today = new Date();
    const dateStamp = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, "0"),
      String(today.getDate()).padStart(2, "0")
    ].join("-");
    link.download = `countertop-bills-${dateStamp}.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast("Today's bills downloaded as an Excel-compatible CSV.");
  });

  orderForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const selected = [...menuList.querySelectorAll(".quantity-input")]
      .map((input) => ({ product_id: input.dataset.productId, quantity: Number.parseInt(input.value, 10) || 0 }))
      .filter((item) => item.quantity > 0);
    if (!selected.length) {
      setMessage(orderMessage, "Add at least one item to create a bill.");
      return;
    }
    const button = document.querySelector("#place-order");
    button.disabled = true;
    setMessage(orderMessage, "");
    try {
      const { data, error } = await supabaseClient.rpc("create_order", { p_items: selected });
      if (error) throw error;
      const { data: order, error: orderError } = await supabaseClient
        .from("orders")
        .select("id,created_at,total,total_cost,order_items(name,quantity,unit_price,unit_cost)")
        .eq("id", data)
        .single();
      if (orderError) throw orderError;
      const { data: todayOrders, error: todayError } = await supabaseClient
        .from("orders")
        .select("id")
        .gte("created_at", localDayRange().start);
      if (todayError) throw todayError;
      renderReceipt(order, todayOrders.length);
      orderForm.reset();
      updateTotal();
      await loadDashboard();
    } catch (error) {
      setMessage(orderMessage, `Could not create bill: ${error.message}`);
    } finally {
      button.disabled = false;
    }
  });

  ordersList.addEventListener("click", async (event) => {
    const button = event.target.closest(".view-bill");
    if (!button) return;
    const { data, error } = await supabaseClient
      .from("orders")
      .select("id,created_at,total,total_cost,order_items(name,quantity,unit_price,unit_cost)")
      .eq("id", button.dataset.orderId)
      .single();
    if (error) {
      showToast(`Could not open bill: ${error.message}`);
      return;
    }
    const { data: earlierOrders, error: countError } = await supabaseClient
      .from("orders")
      .select("id")
      .gte("created_at", localDayRange().start)
      .lte("created_at", data.created_at);
    if (countError) {
      showToast(`Could not load bill number: ${countError.message}`);
      return;
    }
    renderReceipt(data, earlierOrders.length);
  });

  document.querySelector("#print-receipt").addEventListener("click", () => window.print());
  document.querySelector("#close-receipt").addEventListener("click", () => receiptDialog.close());
})();
