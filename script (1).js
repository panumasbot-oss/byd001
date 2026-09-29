/* ==========================================================
   Body Scent — shared script
   One file for every page. Each page runs only what its
   elements need:
     #product-list  -> product.html (cards + mood filter)
     #orderForm     -> order.html (prefill + send order)
     #ordersTable   -> admin.html (orders from Google Sheet CSV)
   ========================================================== */

(function () {
  "use strict";

  var SCRIPT_URL =
    "https://script.google.com/macros/s/AKfycbyJmaEJ-H99dWOBgILoRVkTCxVc09V_Y9l5PgPBlNvePE0kjlOJ9o_Mbpv3Ciw8p7cxUg/exec";

  var CSV_URL =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQi6UfAMj5TnRLiGQCZu3h2kZ5LJ60bqN710rbwKReKRvVxVuwGjmkaitthki1ijU09U2kScBWHvUXR/pub?gid=0&single=true&output=csv";

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

  function getFieldValue(id) {
    var el = document.getElementById(id);
    if (!el) return "";
    var v = "value" in el ? el.value : el.textContent;
    return String(v).trim();
  }

  function isValidMood(mood) {
    return MOODS.some(function (m) {
      return m.key === mood;
    });
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
    // Prefill both #items and #total from the URL
    var params = new URLSearchParams(window.location.search);
    var item = params.get("item");
    var price = params.get("price");
    if (item !== null) setFieldValue(document.getElementById("items"), item);
    if (price !== null) setFieldValue(document.getElementById("total"), price);

    form.addEventListener("submit", function (e) {
      e.preventDefault();

      var payload = {
        customerName: getFieldValue("customerName"),
        contact: getFieldValue("contact"),
        items: getFieldValue("items"),
        total: getFieldValue("total"),
        note: getFieldValue("note")
      };

      var submitBtn = form.querySelector('[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;

      fetch(SCRIPT_URL, {
        method: "POST",
        body: JSON.stringify(payload)
      })
        .then(() => {
          window.location.href = "thankyou.html";
        })
        .catch((error) => {
          console.error(error);
          alert("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
          if (submitBtn) submitBtn.disabled = false;
        });
    });
  }

  /* ==========================================================
     admin.html
     Columns (same order as the Sheet):
     วันเวลา | ชื่อลูกค้า | เบอร์โทร/Line | รายการสินค้า | จำนวนเงินรวม | หมายเหตุ
     ========================================================== */

  // Minimal CSV parser: quoted fields, "" escapes, commas and
  // line breaks inside quotes, CRLF or LF line endings.
  function parseCSV(text) {
    var rows = [];
    var row = [];
    var field = "";
    var inQuotes = false;

    text = text.replace(/^\uFEFF/, "");

    for (var i = 0; i < text.length; i++) {
      var c = text.charAt(i);

      if (inQuotes) {
        if (c === '"') {
          if (text.charAt(i + 1) === '"') {
            field += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          field += c;
        }
      } else if (c === '"') {
        inQuotes = true;
      } else if (c === ",") {
        row.push(field);
        field = "";
      } else if (c === "\n" || c === "\r") {
        if (c === "\r" && text.charAt(i + 1) === "\n") i++;
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else {
        field += c;
      }
    }

    if (field !== "" || row.length > 0) {
      row.push(field);
      rows.push(row);
    }

    // Drop completely empty rows
    return rows.filter(function (r) {
      return r.some(function (cell) {
        return cell.trim() !== "";
      });
    });
  }

  function initAdminPage(table) {
    var tbody = table.querySelector("tbody") || table.appendChild(document.createElement("tbody"));
    var colCount = table.querySelectorAll("thead th").length || 6;

    function showMessage(text) {
      tbody.textContent = "";
      var tr = document.createElement("tr");
      var td = document.createElement("td");
      td.colSpan = colCount;
      td.textContent = text;
      tr.appendChild(td);
      tbody.appendChild(tr);
    }

    showMessage("กำลังโหลดข้อมูล...");

    fetch(CSV_URL + "&_=" + Date.now())
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.text();
      })
      .then(function (text) {
        var rows = parseCSV(text);

        // Skip a header row if the Sheet has one (its first cell has no digits, unlike a date)
        if (rows.length > 0 && !/\d/.test(rows[0][0] || "")) {
          rows.shift();
        }

        // Rows are appended over time, so reversing gives latest first
        rows.reverse();

        if (rows.length === 0) {
          showMessage("ยังไม่มีคำสั่งซื้อ");
          return;
        }

        tbody.textContent = "";
        rows.forEach(function (r) {
          var tr = document.createElement("tr");
          for (var i = 0; i < 6; i++) {
            var td = document.createElement("td");
            td.textContent = r[i] !== undefined && r[i] !== "" ? r[i] : "-";
            tr.appendChild(td);
          }
          tbody.appendChild(tr);
        });
      })
      .catch(function (error) {
        console.error(error);
        showMessage("โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
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
