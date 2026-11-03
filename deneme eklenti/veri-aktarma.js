/**
 * Atlas `da-vinci/luca/data-write` (veri-aktarma) SSO Köprü Sayfası
 * - Luca `/Luca/luca.do` adresine doğrudan GET isteği atıldığında "LUCA HATA - Lütfen sayfayı yenilemeyin." verir.
 * - Eğer açık bir Luca sekmesi yoksa, bu sayfa `LUCA_TOKEN` ile `/Luca/ssoGiris.do` adresine POST yaparak
 *   yeni bir Luca sekmesini hatasız açar.
 */
chrome.storage.sync.get(["LUCA_TOKEN", "CURRENT_LUCA_WINDOW_IP"], (res) => {
  const token = res.LUCA_TOKEN;
  const host = res.CURRENT_LUCA_WINDOW_IP || "auygs.luca.com.tr";

  if (!token) {
    document.getElementById("spinner").style.display = "none";
    document.getElementById("statusTitle").textContent = "Açık Luca Sekmesi veya SSO Token Bulunamadı";
    document.getElementById("statusDesc").innerHTML =
      'Lütfen önce <a href="https://agiris.luca.com.tr/" target="_blank">agiris.luca.com.tr</a> adresinden Luca\'ya giriş yapıp Muhasebe ekranını açın, ardından Test Panelinden tekrar "Aktar" butonuna tıklayın.';
    return;
  }

  const form = document.getElementById("lucaSsoForm");
  form.action = `https://${host}/Luca/ssoGiris.do`;
  document.getElementById("inputS").value = token;
  document.getElementById("inputT").value = String(Date.now());
  form.submit();
});
