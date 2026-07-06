/**
 * Prebuild script: downloads an embedded Python 3.9 runtime for Windows packaging.
 *
 * Output: `python-embed/` with winsdk installed for GPS access.
 * Referenced by getPythonPath() in src/main/index.ts when app.isPackaged.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const https = require('https');
const AdmZip = require('adm-zip');

async function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, (response) => {
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve();
            });
        }).on('error', (err) => {
            fs.unlink(dest, () => reject(err));
        });
    });
}

async function setupPython() {
    try {
        // First, install adm-zip if not already installed
        try {
            require.resolve('adm-zip');
        } catch (e) {
            console.log('Installing adm-zip...');
            execSync('npm install adm-zip');
        }

        const pythonVersion = '3.9.7';
        const pythonUrl = `https://www.python.org/ftp/python/${pythonVersion}/python-${pythonVersion}-embed-amd64.zip`;
        const pythonDir = path.join(__dirname, 'python-embed');
        const zipPath = path.join(__dirname, 'python-embed.zip');

        // Create python-embed directory if it doesn't exist
        if (!fs.existsSync(pythonDir)) {
            fs.mkdirSync(pythonDir);
        }

        // Download Python embedded package
        console.log('Downloading Python embedded package...');
        await downloadFile(pythonUrl, zipPath);
        
        console.log('Download completed. Extracting...');
        const zip = new AdmZip(zipPath);
        zip.extractAllTo(pythonDir, true);
        console.log('Extraction completed.');
        
        // Clean up the zip file
        fs.unlinkSync(zipPath);

        // Enable pip by modifying python*._pth file
        const pthFile = fs.readdirSync(pythonDir)
            .find(file => file.match(/python\d+\._pth/));
            
        if (pthFile) {
            const pthPath = path.join(pythonDir, pthFile);
            let content = fs.readFileSync(pthPath, 'utf8');
            content = content.replace('#import site', 'import site');
            fs.writeFileSync(pthPath, content);
        }

        // Download and install pip
        console.log('Setting up pip...');
        const getPipUrl = 'https://bootstrap.pypa.io/get-pip.py';
        const getPipPath = path.join(pythonDir, 'get-pip.py');
        
        await downloadFile(getPipUrl, getPipPath);
        
        // Install pip
        console.log('Installing pip...');
        const pythonExe = path.join(pythonDir, 'python.exe');
        execSync(`"${pythonExe}" "${getPipPath}"`, { stdio: 'inherit' });

        // Install required packages
        console.log('Installing required packages...');
        execSync(`"${pythonExe}" -m pip install winsdk`, { stdio: 'inherit' });

        // Clean up get-pip.py
        fs.unlinkSync(getPipPath);

        console.log('Setup completed successfully!');
    } catch (error) {
        console.error('Error during setup:', error);
        process.exit(1);
    }
}

// Run the setup
setupPython();