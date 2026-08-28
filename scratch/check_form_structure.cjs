const fs = require('fs');
const path = require('path');

// We have the prompt text with the HTML. Let's see how the input names in Luca's fisDetayFormArray are structured:
// In Luca's fisDetayFormArray:
// <form name="fisDetayFormArray" ...>
// In this form, rows have input fields like:
// name="HESAP_KODU", name="EVRAK_NO", name="EVRAK_TARIH", name="BELGE_TURU", name="ACIKLAMA", name="BORC", name="ALACAK"
// OR document.forms['fisDetayFormArray']
