const fs = require('fs');
const path = require('path');

function replaceRed(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        if (fs.statSync(filePath).isDirectory()) {
            replaceRed(filePath);
        } else if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
            let content = fs.readFileSync(filePath, 'utf8');
            content = content.replace(/([a-z:-]*)-red-([0-9]{2,3})/g, '$1-primary-$2');
            fs.writeFileSync(filePath, content);
        }
    }
}
replaceRed('src');
