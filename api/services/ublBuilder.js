import { create } from 'xmlbuilder2';
import { v4 as uuidv4 } from 'uuid';

export class UblBuilder {
  /**
   * fatura: {
   *   fatura_tarihi, 
   *   fatura_no, 
   *   fatura_senaryo: 'TICARIFATURA' | 'EARSIVFATURA',
   *   para_birimi: 'TRY',
   *   kdv_orani,
   *   toplam_tutar, // vergisiz
   *   toplam_kdv_tutar,
   *   genel_toplam
   * }
   * supplier: { ad, soyad, firma_adi, vkn, vergi_dairesi, adres, il, ilce, ulke }
   * customer: { ad, soyad, firma_adi, vkn, vergi_dairesi, adres, il, ilce, ulke }
   * items: [{ urun_adi, miktar, birim, birim_fiyat, kdv_orani }]
   */
  static buildInvoiceXml(fatura, supplier, customer, items) {
    const ettn = uuidv4();
    const issueDate = fatura.fatura_tarihi.split('T')[0];
    const issueTime = new Date().toISOString().split('T')[1].substring(0, 8); // HH:mm:ss
    const currency = fatura.para_birimi || 'TRY';

    const ns = {
      '@xmlns': 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2',
      '@xmlns:cac': 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2',
      '@xmlns:cbc': 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2',
      '@xmlns:ccts': 'urn:un:unece:uncefact:documentation:2',
      '@xmlns:ext': 'urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2',
      '@xmlns:qdt': 'urn:oasis:names:specification:ubl:schema:xsd:QualifiedDatatypes-2',
      '@xmlns:ubltr': 'urn:oasis:names:specification:ubl:schema:xsd:TurkishCustomizationExtensionComponents',
      '@xmlns:udt': 'urn:un:unece:uncefact:data:specification:UnqualifiedDataTypesSchemaModule:2'
    };

    const doc = create({ version: '1.0', encoding: 'UTF-8' })
      .ele('Invoice', ns)
        .ele('cbc:UBLVersionID').txt('2.1').up()
        .ele('cbc:CustomizationID').txt('TR1.2').up()
        .ele('cbc:ProfileID').txt(fatura.fatura_senaryo || 'TICARIFATURA').up()
        .ele('cbc:ID').txt(fatura.fatura_no || '').up()
        .ele('cbc:CopyIndicator').txt('false').up()
        .ele('cbc:UUID').txt(ettn).up()
        .ele('cbc:IssueDate').txt(issueDate).up()
        .ele('cbc:IssueTime').txt(issueTime).up()
        .ele('cbc:InvoiceTypeCode').txt('SATIS').up()
        .ele('cbc:DocumentCurrencyCode').txt(currency).up()
        .ele('cbc:LineCountNumeric').txt(items.length.toString()).up();

    // Supplier
    const supplierParty = doc.ele('cac:AccountingSupplierParty').ele('cac:Party');
    this.addParty(supplierParty, supplier);
    supplierParty.up().up();

    // Customer
    const customerParty = doc.ele('cac:AccountingCustomerParty').ele('cac:Party');
    this.addParty(customerParty, customer);
    customerParty.up().up();

    // TaxTotal
    const taxTotal = doc.ele('cac:TaxTotal')
      .ele('cbc:TaxAmount', { currencyID: currency }).txt(fatura.toplam_kdv_tutar.toFixed(2)).up()
      .ele('cac:TaxSubtotal')
        .ele('cbc:TaxableAmount', { currencyID: currency }).txt(fatura.toplam_tutar.toFixed(2)).up()
        .ele('cbc:TaxAmount', { currencyID: currency }).txt(fatura.toplam_kdv_tutar.toFixed(2)).up()
        .ele('cac:TaxCategory')
          .ele('cac:TaxScheme')
            .ele('cbc:Name').txt('KDV').up()
            .ele('cbc:TaxTypeCode').txt('0015').up()
          .up()
        .up()
      .up();
    taxTotal.up();

    // LegalMonetaryTotal
    doc.ele('cac:LegalMonetaryTotal')
      .ele('cbc:LineExtensionAmount', { currencyID: currency }).txt(fatura.toplam_tutar.toFixed(2)).up()
      .ele('cbc:TaxExclusiveAmount', { currencyID: currency }).txt(fatura.toplam_tutar.toFixed(2)).up()
      .ele('cbc:TaxInclusiveAmount', { currencyID: currency }).txt(fatura.genel_toplam.toFixed(2)).up()
      .ele('cbc:AllowanceTotalAmount', { currencyID: currency }).txt('0.00').up()
      .ele('cbc:PayableAmount', { currencyID: currency }).txt(fatura.genel_toplam.toFixed(2)).up()
    .up();

    // InvoiceLines
    items.forEach((item, index) => {
      const lineTotal = (item.miktar * item.birim_fiyat).toFixed(2);
      const lineTax = (lineTotal * (item.kdv_orani / 100)).toFixed(2);

      const line = doc.ele('cac:InvoiceLine')
        .ele('cbc:ID').txt((index + 1).toString()).up()
        .ele('cbc:InvoicedQuantity', { unitCode: 'NIU' }).txt(item.miktar.toString()).up()
        .ele('cbc:LineExtensionAmount', { currencyID: currency }).txt(lineTotal).up()
        .ele('cac:TaxTotal')
          .ele('cbc:TaxAmount', { currencyID: currency }).txt(lineTax).up()
          .ele('cac:TaxSubtotal')
            .ele('cbc:TaxableAmount', { currencyID: currency }).txt(lineTotal).up()
            .ele('cbc:TaxAmount', { currencyID: currency }).txt(lineTax).up()
            .ele('cbc:Percent').txt(item.kdv_orani.toString()).up()
            .ele('cac:TaxCategory')
              .ele('cac:TaxScheme')
                .ele('cbc:Name').txt('KDV').up()
                .ele('cbc:TaxTypeCode').txt('0015').up()
              .up()
            .up()
          .up()
        .up()
        .ele('cac:Item')
          .ele('cbc:Name').txt(item.urun_adi).up()
        .up()
        .ele('cac:Price')
          .ele('cbc:PriceAmount', { currencyID: currency }).txt(item.birim_fiyat.toFixed(2)).up()
        .up();
      line.up();
    });

    return doc.end({ prettyPrint: true });
  }

  static addParty(partyNode, data) {
    const vkn = data.vkn || '11111111111';
    
    partyNode.ele('cac:PartyIdentification')
      .ele('cbc:ID', { schemeID: vkn.length === 11 ? 'TCKN' : 'VKN' }).txt(vkn).up()
    .up();

    const nameNode = partyNode.ele('cac:PartyName');
    if (data.firma_adi) {
      nameNode.ele('cbc:Name').txt(data.firma_adi).up();
    } else {
      nameNode.ele('cbc:Name').txt(`${data.ad || ''} ${data.soyad || ''}`.trim()).up();
    }
    nameNode.up();

    partyNode.ele('cac:PostalAddress')
      .ele('cbc:StreetName').txt(data.adres || '').up()
      .ele('cbc:CitySubdivisionName').txt(data.ilce || '').up()
      .ele('cbc:CityName').txt(data.il || '').up()
      .ele('cac:Country')
        .ele('cbc:Name').txt(data.ulke || 'Türkiye').up()
      .up()
    .up();

    partyNode.ele('cac:PartyTaxScheme')
      .ele('cac:TaxScheme')
        .ele('cbc:Name').txt(data.vergi_dairesi || '').up()
      .up()
    .up();

    if (!data.firma_adi) {
      partyNode.ele('cac:Person')
        .ele('cbc:FirstName').txt(data.ad || '').up()
        .ele('cbc:FamilyName').txt(data.soyad || '').up()
      .up();
    }
  }
}
