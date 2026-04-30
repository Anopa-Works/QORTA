const fs = require('fs');
const path = require('path');

function getAllFiles(dirPath, arrayOfFiles) {
    files = fs.readdirSync(dirPath);

    arrayOfFiles = arrayOfFiles || [];

    files.forEach(function (file) {
        if (fs.statSync(dirPath + "/" + file).isDirectory()) {
            arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles);
        } else {
            arrayOfFiles.push(path.join(dirPath, "/", file));
        }
    });

    return arrayOfFiles;
}

const rootDir = __dirname;
// We only care about user dirs, not node_modules or hidden dirs
const dirsToCheck = ['reels', 'public'];

let pngFiles = [];

dirsToCheck.forEach(dir => {
    const fullPath = path.join(rootDir, dir);
    if (fs.existsSync(fullPath)) {
        const files = getAllFiles(fullPath);
        pngFiles = pngFiles.concat(files.filter(file => file.toLowerCase().endsWith('.png')));
    }
});

console.log(`Checking ${pngFiles.length} PNG files...`);

pngFiles.forEach(file => {
    try {
        const buffer = fs.readFileSync(file);
        // PNG magic number: 89 50 4E 47 0D 0A 1A 0A
        if (buffer.length < 8 ||
            buffer[0] !== 0x89 ||
            buffer[1] !== 0x50 ||
            buffer[2] !== 0x4E ||
            buffer[3] !== 0x47 ||
            buffer[4] !== 0x0D ||
            buffer[5] !== 0x0A ||
            buffer[6] !== 0x1A ||
            buffer[7] !== 0x0A) {

            console.error(`INVALID PNG HEADER: ${file}`);
            // See what it might be
            if (buffer.length > 2 && buffer[0] === 0xFF && buffer[1] === 0xD8) {
                console.log(`  -> Looks like a JPEG`);
            } else if (buffer.length > 4 && buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
                console.log(`  -> Looks like a GIF`);
            } else if (buffer.length > 4 && buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) {
                console.log(`  -> Looks like a WEBP (RIFF)`);
            } else {
                console.log(`  -> Unknown header: ${buffer.slice(0, 8).toString('hex')}`);
            }
        }
    } catch (err) {
        console.error(`Error reading file ${file}: ${err.message}`);
    }
});

console.log('Done.');
