const fs = require('fs');
const path = require('path');

const hudPath = path.join(__dirname, 'EMPIRE_HUD.html');
const uiDir = path.join(__dirname, 'ui');

if (!fs.existsSync(uiDir)) {
    fs.mkdirSync(uiDir, { recursive: true });
}

let html = fs.readFileSync(hudPath, 'utf-8');

const scriptRegex = /<script>([\s\S]*?)<\/script>/;
const match = html.match(scriptRegex);

if (match) {
    const scriptContent = match[1];

    // Save the monolithic script to a legacy file to break it down.
    fs.writeFileSync(path.join(uiDir, 'legacy_script.js'), scriptContent);

    // Replace script tag in HTML
    html = html.replace(scriptRegex, '<script type="module" src="ui/main.js"></script>');
    fs.writeFileSync(hudPath, html);
    console.log("Extracted legacy_script.js and updated EMPIRE_HUD.html");
} else {
    console.log("No script tag found.");
}
