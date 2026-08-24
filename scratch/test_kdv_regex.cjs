const text = 'Hesaplanan KDV Tevkifat(%30)';
const label = 'Hesaplanan\\s*KDV(?!\\s*Tevkifat)';
const regex = new RegExp(`(?:\\s*${label}\\s*)`, 'i');
console.log(text.match(regex));
