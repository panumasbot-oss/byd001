/* ==========================================================
   Body Scent — shared script
   One file for every page. Each page runs only what its
   elements need:
     #product-list  -> product page (cards + mood filter)
     #orderForm     -> order page (prefill + save order)
     #ordersTable   -> admin page (order list)
   ========================================================== */

(function () {
  "use strict";

  var STORAGE_KEY = "bodyScentOrders";

  var MOODS = [
    { key: "all", label: "ทั้งหมด" },
    { key: "fresh", label: "Fresh" },
    { key: "sweet", label: "Sweet" },
    { key: "confident", label: "Confident" },
    { key: "romance", label: "Romance" }
  ];

  var TYPE_LABELS = { spray: "น้ำหอมฉีดตัว", rollon: "โรลออน" };

  /* ---------- Helpers ---------- */

  function formatNumber(value) {
    var n = Number(value);
    return isNaN(n) ? String(value) : n.toLocaleString("th-TH");
  }

  // Works for inputs/textareas (value) and plain elements (textContent)
  function setFieldValue(el, value) {
    if (!el) return;
    if ("value" in el) {
      el.value = value;
    } else {
      el.textContent = value;
    }
  }

  function getFieldValue(el) {
    if (!el) return "";
    var v = "value" in el ? el.value : el.textContent;
    return String(v).trim();
  }

  function getField(form, name) {
    return form.elements[name] || form.querySelector("#" + name);
  }

  function isValidMood(mood) {
    return MOODS.some(function (m) {
      return m.key === mood;
    });
  }

  function readOrders() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      var data = raw ? JSON.parse(raw) : [];
      return Array.isArray(data) ? data : [];
    } catch (err) {
      return [];
    }
  }

  /* ==========================================================
     product.html
     ========================================================== */

  function initProductPage(listEl) {
    var filterBar = document.getElementById("filter-bar");
    var products = [];
    var activeMood = "all";

    function createCard(product) {
      var card = document.createElement("article");
      card.className = "product-card mood-" + product.mood;

      var media = document.createElement("div");
      media.className = "product-card__media";
      var img = document.createElement("img");
      img.src = product.image;
      img.alt = product.name;
      img.loading = "lazy";
      img.addEventListener("error", function () {
        img.style.visibility = "hidden";
      });
      media.appendChild(img);

      var body = document.createElement("div");
      body.className = "product-card__body";

      var title = document.createElement("h3");
      title.className = "product-card__title mood-dot";
      title.textContent = product.name;

      var desc = document.createElement("p");
      desc.className = "product-card__desc";
      desc.textContent = product.description;

      var meta = document.createElement("div");
      meta.className = "product-card__meta";
      var typeLabel = TYPE_LABELS[product.type] || product.type;
      meta.appendChild(
        document.createTextNode(product.size ? typeLabel + " · " + product.size : typeLabel)
      );
      var price = document.createElement("span");
      price.className = "price";
      price.textContent = formatNumber(product.price) + " บาท";
      meta.appendChild(price);

      var params = new URLSearchParams({
        item: product.name,
        price: String(product.price)
      });
      var buy = document.createElement("a");
      buy.className = "btn";
      buy.href = "order.html?" + params.toString();
      buy.textContent = "สั่งซื้อ";
      buy.style.marginTop = "1.5rem";

      body.appendChild(title);
      body.appendChild(desc);
      body.appendChild(meta);
      body.appendChild(buy);

      card.appendChild(media);
      card.appendChild(body);
      return card;
    }

    function render() {
      var shown = products.filter(function (p) {
        return activeMood === "all" || p.mood === activeMood;
      });

      listEl.textContent = "";

      if (shown.length === 0) {
        var empty = document.createElement("p");
        empty.textContent = "ไม่พบสินค้าในหมวดนี้";
        listEl.appendChild(empty);
        return;
      }

      shown.forEach(function (p) {
        listEl.appendChild(createCard(p));
      });
    }

    function updateFilterButtons() {
      if (!filterBar) return;
      filterBar.querySelectorAll("[data-mood]").forEach(function (btn) {
        var on = btn.getAttribute("data-mood") === activeMood;
        btn.classList.toggle("is-active", on);
        btn.setAttribute("aria-pressed", on ? "true" : "false");
      });
    }

    function setMood(mood) {
      activeMood = isValidMood(mood) ? mood : "all";
      updateFilterButtons();
      render();
      try {
        var url = new URL(window.location.href);
        if (activeMood === "all") {
          url.searchParams.delete("mood");
        } else {
          url.searchParams.set("mood", activeMood);
        }
        window.history.replaceState(null, "", url);
      } catch (err) {
        /* URL sync is optional */
      }
    }

    function buildFilterBar() {
      if (!filterBar) return;

      // Create buttons only if the HTML doesn't already have them
      if (!filterBar.querySelector("[data-mood]")) {
        MOODS.forEach(function (m) {
          var btn = document.createElement("button");
          btn.type = "button";
          btn.className = "filter__item";
          btn.setAttribute("data-mood", m.key);
          btn.textContent = m.label;
          filterBar.appendChild(btn);
        });
      }

      filterBar.addEventListener("click", function (e) {
        var btn = e.target.closest("[data-mood]");
        if (btn && filterBar.contains(btn)) {
          setMood(btn.getAttribute("data-mood"));
        }
      });
    }

    buildFilterBar();

    var initialMood = new URLSearchParams(window.location.search).get("mood");
    activeMood = isValidMood(initialMood) ? initialMood : "all";

    fetch("products.json")
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (data) {
        products = Array.isArray(data) ? data : [];
        updateFilterButtons();
        render();
      })
      .catch(function () {
        listEl.textContent = "";
        var msg = document.createElement("p");
        msg.textContent = "โหลดรายการสินค้าไม่สำเร็จ กรุณาลองใหม่อีกครั้ง";
        listEl.appendChild(msg);
      });
  }

  /* ==========================================================
     order.html
     ========================================================== */

  function initOrderPage(form) {
    var itemsEl = document.getElementById("items");
    var totalEl = document.getElementById("total");

    // Prefill both fields from the URL
    var params = new URLSearchParams(window.location.search);
    var item = params.get("item");
    var price = params.get("price");
    if (item !== null) setFieldValue(itemsEl, item);
    if (price !== null) setFieldValue(totalEl, price);

    form.addEventListener("submit", function (e) {
      e.preventDefault();

      var order = {
        customerName: getFieldValue(getField(form, "customerName")),
        contact: getFieldValue(getField(form, "contact")),
        items: getFieldValue(itemsEl),
        total: getFieldValue(totalEl),
        note: getFieldValue(getField(form, "note")),
        timestamp: new Date().toISOString()
      };

      try {
        var orders = readOrders();
        orders.push(order);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
      } catch (err) {
        window.alert("บันทึกคำสั่งซื้อไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
        return;
      }

      window.location.href = "thankyou.html";
    });
  }

  /* ==========================================================
     admin.html
     Table column order (must match <thead>):
     date | customerName | contact | items | total | note
     ========================================================== */

  function initAdminPage(table) {
    var tbody = table.querySelector("tbody") || table.appendChild(document.createElement("tbody"));
    var orders = readOrders().slice();

    orders.sort(function (a, b) {
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

    tbody.textContent = "";

    if (orders.length === 0) {
      var colCount = table.querySelectorAll("thead th").length || 6;
      var emptyRow = document.createElement("tr");
      var emptyCell = document.createElement("td");
      emptyCell.colSpan = colCount;
      emptyCell.textContent = "ยังไม่มีคำสั่งซื้อ";
      emptyRow.appendChild(emptyCell);
      tbody.appendChild(emptyRow);
      return;
    }

    orders.forEach(function (order) {
      var date = new Date(order.timestamp);
      var dateText = isNaN(date.getTime()) ? "-" : date.toLocaleString("th-TH");

      var totalText = "-";
      if (order.total !== undefined && order.total !== "") {
        totalText = isNaN(Number(order.total))
          ? String(order.total)
          : formatNumber(order.total) + " บาท";
      }

      var cells = [
        dateText,
        order.customerName || "-",
        order.contact || "-",
        order.items || "-",
        totalText,
        order.note || "-"
      ];

      var row = document.createElement("tr");
      cells.forEach(function (text) {
        var td = document.createElement("td");
        td.textContent = text;
        row.appendChild(td);
      });
      tbody.appendChild(row);
    });
  }

  /* ---------- Page detection ---------- */

  document.addEventListener("DOMContentLoaded", function () {
    var productList = document.getElementById("product-list");
    var orderForm = document.getElementById("orderForm");
    var ordersTable = document.getElementById("ordersTable");

    if (productList) initProductPage(productList);
    if (orderForm) initOrderPage(orderForm);
    if (ordersTable) initAdminPage(ordersTable);
  });
})();
