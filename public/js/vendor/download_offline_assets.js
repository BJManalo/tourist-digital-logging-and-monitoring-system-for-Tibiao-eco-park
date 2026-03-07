const https = require('https');
const fs = require('fs');
const path = require('path');

// The script is now in public/js/vendor, so we need to go up two directories to reach the public folder
const publicDir = path.join(__dirname, '..', '..');
const vendorJsDir = path.join(publicDir, 'js', 'vendor');
const fontsDir = path.join(publicDir, 'fonts');
const cssDir = path.join(publicDir, 'css');

// Ensure directories exist
[vendorJsDir, fontsDir, cssDir].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

function download(url, dest) {
    return new Promise((resolve, reject) => {
        https.get(url, (response) => {
            if (response.statusCode === 301 || response.statusCode === 302 || response.statusCode === 307) {
                const newUrl = new URL(response.headers.location, url).href;
                return download(newUrl, dest).then(resolve).catch(reject);
            }
            if (response.statusCode !== 200) {
                return reject(new Error('Failed to download: ' + response.statusCode));
            }
            const file = fs.createWriteStream(dest);
            response.pipe(file);
            file.on('finish', () => {
                file.close(resolve);
            });
        }).on('error', err => {
            fs.unlink(dest, () => reject(err));
        });
    });
}

function downloadString(url, headers = {}) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers }, (response) => {
            if (response.statusCode === 301 || response.statusCode === 302 || response.statusCode === 307) {
                const newUrl = new URL(response.headers.location, url).href;
                return downloadString(newUrl, headers).then(resolve).catch(reject);
            }
            let data = '';
            response.on('data', chunk => data += chunk);
            response.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

async function run() {
    console.log("Downloading JS libraries...");
    // Download explicit CDN links
    await download('https://unpkg.com/lucide@latest/dist/umd/lucide.min.js', path.join(vendorJsDir, 'lucide.js'));
    await download('https://unpkg.com/html5-qrcode/html5-qrcode.min.js', path.join(vendorJsDir, 'html5-qrcode.js'));
    await download('https://cdn.jsdelivr.net/npm/chart.js/dist/chart.umd.js', path.join(vendorJsDir, 'chart.js'));

    console.log("Downloading Fonts CSS...");
    const fontUrl = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Montserrat:wght@700;800&display=swap';
    const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36';

    let css = await downloadString(fontUrl, { 'User-Agent': userAgent });

    // Extract url() and download those binary font files
    const urlMatches = [...css.matchAll(/url\((https:\/\/[^)]+)\)/g)];
    const downloads = [];

    let fontIndex = 0;
    for (const match of urlMatches) {
        let urlList = match[1].replace(/['"]/g, '');
        const filename = `font_${fontIndex}.woff2`;
        const dest = path.join(fontsDir, filename);

        css = css.replace(urlList, `../fonts/${filename}`);
        downloads.push(download(urlList, dest).catch(e => console.error("Error downloading " + urlList, e)));
        fontIndex++;
    }

    console.log(`Downloading ${downloads.length} font files...`);
    await Promise.all(downloads);

    fs.writeFileSync(path.join(cssDir, 'fonts.css'), css);

    console.log("All offline assets downloaded successfully!");
}

run().catch(console.error);
