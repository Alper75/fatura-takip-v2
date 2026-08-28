const fs = require('fs');
const path = require('path');

const scriptPath = path.resolve(__dirname, '../1.1.24_0/luca-app-content-script-basic.js');
let content = fs.readFileSync(scriptPath, 'utf8');

const targetOld = `(e.e_document_type||e.printed_document_type)&&function(e,t){var n="";switch(o){case"0":n="EInvoice"==e?7:8;break;case"1":switch(e){case"Invoice":n=1;break;case"EInvoice":n=9;break;default:n=10}}var r=document.querySelector("#beyanBelgeTuru"+t);r.click(),r.closest(".multiselect").querySelector(".checkboxes input[value='".concat(n,"']")).click()}(e.e_document_type||e.printed_document_type,t);!function(e,t){var n=document.querySelector("#alisSatisTuru".concat(t));n.click(),n.closest(".multiselect").querySelector(".checkboxes label input[value='".concat(e,"']")).click()}(e.purchase_sales_type,t)`;

const replacement = `function(row, idx) {
  // 1. Beyan Belge Türü (td24)
  var bVal = row.beyanBelgeTuru || "";
  if (!bVal) {
    var dType = row.e_document_type || row.printed_document_type || "EInvoice";
    if (o === "0") {
      bVal = (dType === "EInvoice" ? "7" : "8");
    } else {
      switch (dType) {
        case "Invoice": bVal = "1"; break;
        case "EInvoice": bVal = "9"; break;
        default: bVal = "10";
      }
    }
  }
  var bSelect = document.querySelector("#beyanBelgeTuru" + idx);
  if (bSelect) {
    bSelect.value = bVal;
    bSelect.dispatchEvent(new Event("change", { bubbles: true }));
    var m1 = bSelect.closest(".multiselect");
    if (m1) {
      var box1 = m1.querySelector(".selectBox") || m1.querySelector(".overSelect");
      if (box1) box1.click();
      var chk1 = m1.querySelector(".checkboxes input[value='" + bVal + "']") || m1.querySelector(".checkboxes input");
      if (chk1 && !chk1.checked) chk1.click();
    }
  }

  // 2. Alış Satış Türü (td25)
  var aVal = row.alisSatisTuru || row.purchase_sales_type || "1";
  var aSelect = document.querySelector("#alisSatisTuru" + idx);
  if (aSelect) {
    aSelect.value = aVal;
    aSelect.dispatchEvent(new Event("change", { bubbles: true }));
    var m2 = aSelect.closest(".multiselect");
    if (m2) {
      var box2 = m2.querySelector(".selectBox") || m2.querySelector(".overSelect");
      if (box2) box2.click();
      var chk2 = m2.querySelector(".checkboxes label input[value='" + aVal + "']") || m2.querySelector(".checkboxes input[value='" + aVal + "']") || m2.querySelector(".checkboxes input");
      if (chk2 && !chk2.checked) chk2.click();
    }
  }

  // 3. Kayıt Alt Türü (td26)
  var kVal = row.kayitAltTuru || "1";
  var kSelect = document.querySelector("#kayitAltTuru" + idx);
  if (kSelect) {
    kSelect.value = kVal;
    kSelect.dispatchEvent(new Event("change", { bubbles: true }));
    var m3 = kSelect.closest(".multiselect");
    if (m3) {
      var box3 = m3.querySelector(".selectBox") || m3.querySelector(".overSelect");
      if (box3) box3.click();
      var chk3 = m3.querySelector(".checkboxes label input[value='" + kVal + "']") || m3.querySelector(".checkboxes input[value='" + kVal + "']") || m3.querySelector(".checkboxes input");
      if (chk3 && !chk3.checked) chk3.click();
    }
  }
}(e, t)`;

if (content.includes(targetOld)) {
  content = content.replace(targetOld, replacement);
  fs.writeFileSync(scriptPath, content, 'utf8');
  console.log('Successfully patched 1.1.24_0/luca-app-content-script-basic.js!');
} else {
  console.error('Target not found!');
}
