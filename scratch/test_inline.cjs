const label = 'Hesaplanan\\s*KDV(?!\\s*Tevkifat)';
const text = 'Hesaplanan KDV(%20) 1.200,00 TL';
const inlineRegex = new RegExp(`(?:\\s*${label}\\s*)[^\\d]*([\\d\\.,]+)`, 'i');
console.log(text.match(inlineRegex));
