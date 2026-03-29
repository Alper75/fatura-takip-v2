# Fatura Uygulaması Yeni Özellikler (v2_app)

Aşağıdaki özellikler, uygulamayı daha kapsamlı ve kullanıcı dostu hale getirmek için planlanmıştır:

* [x] **Cari Hesap Takibi (Defter)**
    * [x] CariHareket ve raporlama modellerinin tanımı
    * [x] Fatura eklendiğinde/silindiğinde otomatik hareket kaydı
    * [x] Vade (Ödeme) tarihi alanı faturalara eklenmesi
    * [x] Güncel Bakiye hesaplama ve listeleme
    * [x] Ekstre görüntüleme sayfası/drawer tasarımı
    * [x] Manuel Tahsilat / Ödeme tuşları

* [x] **Çek / Senet Modülü**
    * [x] Çek/Senet veri tiplerinin (Alınan/Verilen, Bekliyor/Ödendi) eklenmesi
    * [x] AppContext'e Çek/Senet CRUD işlemlerinin eklenmesi
    * [x] Çek/Senet Liste ekranının (CekSenetListe) oluşturulması
    * [x] Çek/Senet Ekleme/Düzenleme çekmecesinin (Drawer) tasarlanması
    * [x] Navigasyon menüsüne (Sidebar) Çek/Senet eklentisi

* [x] **Hatırlatma Sistemi (Gelişmiş)**
    * [x] Dashboard'da "Vadesi Yaklaşan / Geciken Ödemeler" paneli
    * [x] Sağ alt / Sol altta yüzen bir *Bildirim Paneli (Notification Widget)* tasarımı
    * [x] Bildirim Paneli içine İleri Tarihli Tahsilat ve Ödemelerin entegrasyonu
    * [x] Bildirim Paneli içine Çek/Senet vadelerinin entegrasyonu

* [x] **Banka Hesapları (İleri Seviye)**
    * [x] BankaHesabi veri modelinin oluşturulması
    * [x] AppContext'e Banka CRUD işlemlerinin eklenmesi
    * [x] Banka Hesapları listesi (BankaListe) ve Ekleme (BankaDrawer) ekranları
    * [x] Fatura ve Tahsilat/Ödeme işlemlerinde banka hesabı seçimi
    * [x] İşlem yapıldığında banka bakiyesinin otomatik güncellenmesi
    * [x] Excel formatında Banka Ekstresi yükleme (BankaEkstreUpload)
    * [x] Otomatik Cari Eşleştirme algoritması (Açıklama bazlı)
    * [x] Masraf ve Vergi ödemelerini otomatik sınıflandırma (KDV, Muhtasar, Personel vb.)
    * [x] Eşleşmeyen hareketlerin manuel cariye atanması arayüzü
    * [x] Banka Ekstre Listesi (BankaEkstreListesi) ekranının oluşturulması
    * [x] Banka hesap tanımına Kart No ve Hesap No alanlarının eklenmesi
    * [x] Kredi kartı ve Hesaplar Arası Transfer (Virman) otomatik tespit algoritması
    * [x] Banka bakiye hesaplama mantığının (Artı/Eksi) düzeltilmesi
    * [x] Ekstre listesinden Excel çıktısı alma özelliği
    * [x] Akıllı Başlık Tespiti (Ziraat Bankası vb. karmaşık format desteği)

* [x] **Grafikler ve Dashboard**
    * [x] Dashboard genel görünümü ve kart özetleri (Toplam Satış, Alış, Kasa)
    * [x] Aylık Satış vs Alış karşılaştırma grafiği (Bar Chart)
    * [x] Gider Dağılımı (Vergi, Maaş, Kira vb.) (Pie Chart)
    * [x] En çok işlem yapılan Cariler analizi
    * [x] Dashboard'un ana ekran olarak ayarlanması ve Sidebar entegrasyonu

* [x] **🔍 Gelişmiş Arama ve Filtreleme**
    * [x] Listeleme ekranları için ortak Filtre Paneli (FilterBar) bileşeni
    * [x] Tarih aralığına göre filtreleme (Başlangıç - Bitiş)
    * [x] Tutar aralığına göre filtreleme (Min - Max)
    * [x] Durum (Ödeme/Tahsilat) ve Tip bazlı filtreleme
    * [x] Global arama (Ünvan, VKN, Fatura No) entegrasyonu

- [ ] **📅 Takvim Görünümü:** Faturaları takvim üzerinde görme
- [ ] **💾 Otomatik Yedekleme:** LocalStorage veya bulut yedekleme
- [ ] **📱 Mobil Uyumluluk:** Responsive tasarım iyileştirmeleri
- [x] **Karanlık Mod:** Dark/Light tema desteği
- [ ] **📄 Fatura Şablonları:** PDF çıktısı için özelleştirilebilir şablonlar (ATLANDI)

* [x] **Personel Modülü Geliştirmeleri**
    * [x] Sidebar Rol Tabanlı Filtreleme (Admin/Personel ayrımı)
    * [x] Sidebar Genişletilebilir Personel Menüsü
    * [x] Backend API Güncellemeleri (İzin, Masraf, CRUD)
    * [x] Personel Yönetimi Buton Aktivasyonu (Yeni, Düzenle, Sil)
    * [x] Personel Dashboard Buton Aktivasyonu (İzin İste, Masraf İste)
    * [x] AppContext Tip ve Fonksiyon Güncellemeleri
    * [x] Onaylanmış İzin ve Masraf Taleplerinin Listelenmesi (Personel Dashboard)
    * [x] Admin: Talep ve İzin Yönetimi Sekmeli Yapı (Bekleyenler / Onaylananlar)
    * [x] Alan Bazlı Excel İndirme (Onaylılar ve Bekleyenler Ayrı)
    * [x] Personel İçin "Kişisel Puantaj" Ekranı Oluşturulması
    * [x] Puantaj Kayıtları İçin "Yönetici Kilidi" (is_locked) Mekanizması
    * [x] Puantaj Menü Görünürlüğünün Yönetici Kontrolüne Bağlanması (puantaj_menu_active)
    * [x] Backend: DB Migration (is_locked, puantaj_menu_active)
    * [ ] Turso DB Entegrasyonu (Gelecek Adım)
