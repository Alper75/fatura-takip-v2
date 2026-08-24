const fs = require('fs');
let content = fs.readFileSync('api/index.js', 'utf8');

const oldExtractAmount = `      const extractAmount = (label) => {
        const rowRegex = new RegExp(\`<tr[^>]*>[\\\\s\\\\S]*?(?:\${label})[\\\\s\\\\S]*?<\\\\/tr>\`, 'i');
        const rowMatch = htmlContent.match(rowRegex);
        if (!rowMatch) {
          debugRegexMatches[label] = 'NOT_FOUND';
          return 0;
        }

        const rowHtml = rowMatch[0];
        const tdRegex = /<td[^>]*>([\\s\\S]*?)<\\/td>/gi;
        let lastNumber = 'NOT_FOUND';
        
        let tdMatch;
        while ((tdMatch = tdRegex.exec(rowHtml)) !== null) {
          const tdContent = tdMatch[1];
          // Sadece sayısal formatı (virgül ve nokta içeren) arıyoruz
          const numMatch = tdContent.match(/[^\\d]*([\\d\\.,]+)/);
          if (numMatch && numMatch[1]) {
            // Eğer % gibi bir işaret varsa ama asıl tutar son sütundaysa son numarayı tutar
            lastNumber = numMatch[1];
          }
        }

        debugRegexMatches[label] = lastNumber;

        if (lastNumber !== 'NOT_FOUND') {
          let str = lastNumber.trim();
          if (str.includes(',') && str.includes('.')) {
            str = str.replace(/\\./g, '').replace(/,/g, '.');
          } else if (str.includes(',')) {
            str = str.replace(/,/g, '.');
          }
          return parseFloat(str) || 0;
        }
        return 0;
      };`;

const newExtractAmount = `      const extractAmount = (label) => {
        // Find the label and then the next TD cell's content
        const regex = new RegExp(\`(?:\\s*\${label}\\s*)[\\\\s\\\\S]*?<\\\\/td>\\\\s*<td[^>]*>([^<]+)<\\\\/td>\`, 'i');
        const match = htmlContent.match(regex);
        
        let lastNumber = 'NOT_FOUND';
        
        if (match && match[1]) {
           const numMatch = match[1].match(/[^\\d]*([\\d\\.,]+)/);
           if (numMatch && numMatch[1]) {
             lastNumber = numMatch[1];
           }
        } else {
           // Fallback: search within the same cell if it's formatted inline (rare for GIB but possible)
           const inlineRegex = new RegExp(\`(?:\\s*\${label}\\s*)[^\\d]*([\\d\\.,]+)\`, 'i');
           const inlineMatch = htmlContent.match(inlineRegex);
           if (inlineMatch && inlineMatch[1]) {
              lastNumber = inlineMatch[1];
           }
        }

        debugRegexMatches[label] = lastNumber;

        if (lastNumber !== 'NOT_FOUND') {
          let str = lastNumber.trim();
          if (str.includes(',') && str.includes('.')) {
            str = str.replace(/\\./g, '').replace(/,/g, '.');
          } else if (str.includes(',')) {
            str = str.replace(/,/g, '.');
          }
          return parseFloat(str) || 0;
        }
        return 0;
      };`;

content = content.replace(oldExtractAmount, newExtractAmount);
fs.writeFileSync('api/index.js', content);
console.log('Fixed api/index.js regex extraction');
