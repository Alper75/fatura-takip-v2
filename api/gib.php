<?php
require __DIR__ . '/vendor/autoload.php';

use furkankadioglu\efatura\Client;
use furkankadioglu\efatura\Models\Invoice;
use furkankadioglu\efatura\Models\Item;

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}

// JSON verisini al
$input = json_decode(file_get_contents('php://stdin'), true);
if (!$input) {
    $input = json_decode(file_get_contents('php://input'), true);
}

$credentials = $input['credentials'] ?? null;
$invoiceData = $input['invoice'] ?? null;

if (!$credentials || !$invoiceData) {
    echo json_encode(['success' => false, 'message' => 'Eksik veri gönderildi.']);
    exit;
}

try {
    // 1. Client oluştur (Username, Password, TestMode)
    // Not: furkankadioglu/efatura varsayılan olarak test modunda başlar. 
    // Üretim için Client constructor'ında 3. parametre false olmalı.
    $client = new Client($credentials['username'], $credentials['password'], false);
    
    // GİB Portal Girişi
    if (!$client->login()) {
        echo json_encode(['success' => false, 'message' => 'GİB Giriş Başarısız. Kullanıcı adı veya şifre hatalı.']);
        exit;
    }

    // 2. Fatura Modeli Oluştur
    $invoice = new Invoice();
    $uuid = $invoiceData['uuid'] ?? \furkankadioglu\efatura\InvoiceManager::generateUUID();
    $invoice->setUuid($uuid);
    
    // Tarih ve saat (Türkiye formatı d/m/Y)
    $date = date('d/m/Y');
    $time = date('H:i:s');
    $invoice->setDate($date);
    $invoice->setTime($time);
    
    // Alıcı Bilgileri
    $invoice->setTaxIDOrTRID($invoiceData['vknTckn'] ?? '11111111111');
    $invoice->setTitle($invoiceData['unvan'] ?? ($invoiceData['ad'] . ' ' . $invoiceData['soyad']));
    $invoice->setAddress($invoiceData['adres'] ?? 'TÜRKİYE');
    $invoice->setDistrict($invoiceData['ilce'] ?? 'MERKEZ');
    $invoice->setCity($invoiceData['il'] ?? 'ANKARA');
    $invoice->setCountry("Türkiye");
    
    // Mal / Hizmet Satırı
    $item = new Item();
    $item->setName($invoiceData['aciklama'] ?? 'Hizmet Bedeli');
    $item->setQuantity(1);
    $item->setUnit("C62"); // Adet
    $item->setUnitPrice($invoiceData['tutar']);
    $item->setVatRate($invoiceData['kdvOrani'] ?? 20);
    $invoice->addItem($item);
    
    // Hesaplamaları yap (Kütüphane otomatik yapar ama manuel de setleyebiliriz)
    $invoice->setCurrency("TRY");
    
    // 3. Taslağı Oluştur
    $result = $client->createDraft($invoice);
    
    if ($result) {
        // Önizleme HTML'ini al
        $html = $client->getInvoiceHtml($uuid);
        
        echo json_encode([
            'success' => true,
            'uuid' => $uuid,
            'html' => $html,
            'message' => 'Fatura başarıyla (PHP Engine) ile taslaklara eklendi.'
        ]);
    } else {
        echo json_encode(['success' => false, 'message' => 'GİB Taslak oluşturma başarısız.']);
    }

} catch (Exception $e) {
    echo json_encode([
        'success' => false, 
        'message' => 'GİB PHP Hatası: ' . $e->getMessage()
    ]);
}
