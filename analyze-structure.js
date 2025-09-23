#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { promises as fsPromises } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ansiRegex = /\x1B\[[0-9;]*[a-zA-Z]/g;

function logLine(line = '') {
    // Stampa con colori in console
    console.log(line);
    if (writeStream) {
        // Rimuove i colori ANSI dal testo salvato
        const cleanLine = line.replace(ansiRegex, '');
        writeStream.write(cleanLine + '\n');
    }
}

let writeStream = null;

// Directories and files to exclude
const EXCLUDE_DIRS = new Set([
    'node_modules',
    '.git',
    '.vscode',
    '.idea',
    'dist',
    'build',
    'coverage',
    '.nyc_output',
    'logs',
    'tmp',
    'temp',
    '.cache',
    '.parcel-cache',
    '.next',
    '.nuxt',
    'out',
    '__pycache__',
    '.pytest_cache',
    'media'  // ✅ Aggiunto per escludere i file media dalla copia
]);

const EXCLUDE_FILES = new Set([
    '.DS_Store',
    'Thumbs.db',
    '.gitkeep',
    'desktop.ini',
    '.env.local',
    '.env.development.local',
    '.env.test.local',
    '.env.production.local'
]);

// ✅ File da NON copiare in AI-paste (example e lock files)
const EXCLUDE_FROM_COPY = new Set([
    'package-lock.json',
    'yarn.lock',
    'pnpm-lock.yaml',
    '.env.example',
    'README.example.md',
    'config.example.json',
    'docker-compose.example.yml'
]);

// File extensions to highlight
const CODE_EXTENSIONS = new Set([
    '.js', '.mjs', '.ts', '.tsx', '.jsx',
    '.py', '.java', '.cpp', '.c', '.h',
    '.html', '.css', '.scss', '.sass',
    '.json', '.xml', '.yaml', '.yml',
    '.md', '.txt', '.env', '.gitignore',
    '.sh', '.bat', '.ps1'
]);

const CONFIG_FILES = new Set([
    'package.json', 'package-lock.json', 'yarn.lock',
    'tsconfig.json', 'webpack.config.js', 'vite.config.js',
    '.babelrc', '.eslintrc', '.prettierrc',
    'Dockerfile', 'docker-compose.yml',
    '.env', '.env.example', '.gitignore'
]);

function getFileIcon(fileName, isDir) {
    if (isDir) return '📁';

    const ext = path.extname(fileName).toLowerCase();

    if (CONFIG_FILES.has(fileName)) return '⚙️';
    if (fileName.includes('README')) return '📋';
    if (fileName.includes('LICENSE')) return '📄';
    if (fileName.startsWith('.env')) return '🔐';

    switch (ext) {
        case '.js':
        case '.mjs':
        case '.ts': return '🟨';
        case '.jsx':
        case '.tsx': return '⚛️';
        case '.json': return '📊';
        case '.html': return '🌐';
        case '.css':
        case '.scss': return '🎨';
        case '.md': return '📝';
        case '.py': return '🐍';
        case '.java': return '☕';
        case '.cpp':
        case '.c': return '⚡';
        case '.sh': return '🐚';
        case '.yml':
        case '.yaml': return '🔧';
        case '.xml': return '📋';
        case '.mp3':
        case '.wav':
        case '.ogg': return '🎵';
        case '.jpg':
        case '.png':
        case '.gif': return '🖼️';
        default: return '📄';
    }
}

function formatFileSize(stats) {
    const size = stats.size;
    if (size < 1024) return `${size}B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)}KB`;
    if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)}MB`;
    return `${(size / (1024 * 1024 * 1024)).toFixed(1)}GB`;
}

function shouldExclude(itemName, isDir) {
    if (isDir) {
        return EXCLUDE_DIRS.has(itemName) || itemName.startsWith('.');
    }
    return EXCLUDE_FILES.has(itemName);
}

function shouldExcludeFromCopy(fileName) {
    // Escludi file example e lock files
    if (EXCLUDE_FROM_COPY.has(fileName)) return true;
    if (fileName.includes('.example.') || fileName.endsWith('.example')) return true;
    if (fileName.includes('.lock') || fileName.endsWith('-lock.json')) return true;
    
    // Escludi file binari e media
    const ext = path.extname(fileName).toLowerCase();
    const mediaExtensions = ['.mp3', '.wav', '.ogg', '.mp4', '.avi', '.mov', '.jpg', '.png', '.gif', '.pdf'];
    return mediaExtensions.includes(ext);
}

function analyzeDirectory(
    dirPath,
    prefix = '',
    maxDepth = 10,
    currentDepth = 0,
    collectOnly = false,
    filesToCopy = []
) {
    if (currentDepth >= maxDepth) {
        return { totalSize: 0, totalFiles: 0 };
    }

    let totalSize = 0;
    let totalFiles = 0;

    try {
        const rawEntries = fs.readdirSync(dirPath, { withFileTypes: true });

        const entries = rawEntries
            .filter((e) => {
                const isDir = e.isDirectory();
                if (e.isSymbolicLink && e.isSymbolicLink()) return false;
                return !shouldExclude(e.name, isDir);
            })
            .sort((a, b) => {
                if (a.isDirectory() && !b.isDirectory()) return -1;
                if (!a.isDirectory() && b.isDirectory()) return 1;
                return a.name.localeCompare(b.name);
            });

        entries.forEach((entry, idx) => {
            const itemName = entry.name;
            const itemPath = path.join(dirPath, itemName);
            const isDir = entry.isDirectory();
            const isLast = idx === entries.length - 1;

            const connector = isLast ? '└── ' : '├── ';
            const newPrefix = prefix + (isLast ? '    ' : '│   ');

            try {
                const stats = fs.lstatSync(itemPath);

                if (isDir) {
                    const subTotals = analyzeDirectory(itemPath, newPrefix, maxDepth, currentDepth + 1, collectOnly, filesToCopy);
                    totalSize += subTotals.totalSize;
                    totalFiles += subTotals.totalFiles;

                    if (!collectOnly) {
                        const icon = getFileIcon(itemName, true);
                        let displayName = itemName;
                        let extraInfo = subTotals.totalFiles > 0 ? ` (${subTotals.totalFiles} files)` : '';

                        logLine(`${prefix}${connector}${icon} ${displayName}${extraInfo}`);
                    }
                } else {
                    totalSize += stats.size;
                    totalFiles += 1;

                    // ✅ Raccogli file da copiare (solo se non escluso e solo nella prima passata)
                    if (collectOnly && !shouldExcludeFromCopy(itemName)) {
                        filesToCopy.push({
                            sourcePath: itemPath,
                            fileName: itemName,
                            relativePath: path.relative(process.cwd(), itemPath)
                        });
                    }

                    if (!collectOnly) {
                        const icon = getFileIcon(itemName, false);
                        const fileSize = formatFileSize(stats);
                        let displayName = itemName;

                        if (CONFIG_FILES.has(itemName)) {
                            displayName = `\x1b[33m${displayName}\x1b[0m`;
                        } else if (CODE_EXTENSIONS.has(path.extname(itemName))) {
                            displayName = `\x1b[36m${displayName}\x1b[0m`;
                        }

                        logLine(`${prefix}${connector}${icon} ${displayName} [${fileSize}]`);
                    }
                }
            } catch (error) {
                if (!collectOnly) {
                    logLine(`${prefix}${connector}❌ ${itemName} (error: ${error.code || error.message})`);
                }
            }
        });
    } catch (error) {
        if (!collectOnly) {
            logLine(`${prefix}❌ Cannot read directory: ${error.message}`);
        }
    }

    return { totalSize, totalFiles };
}

function printProjectInfo(projectPath) {
    const projectName = path.basename(projectPath);
    const packageJsonPath = path.join(projectPath, 'package.json');

    logLine(`\n🎵 MusicBee Project Structure`);
    logLine(`${'='.repeat(50)}`);
    logLine(`📂 Project: ${projectName}`);
    logLine(`📍 Path: ${projectPath}`);

    if (fs.existsSync(packageJsonPath)) {
        try {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
            logLine(`📦 Version: ${packageJson.version || 'unknown'}`);
            logLine(`📝 Description: ${packageJson.description || 'N/A'}`);

            if (packageJson.main) {
                logLine(`🚀 Entry point: ${packageJson.main}`);
            }
        } catch (error) {
            logLine(`⚠️  Could not parse package.json: ${error.message}`);
        }
    }

    logLine(`${'='.repeat(50)}\n`);
}

async function copyFilesToAIPaste(filesToCopy, targetPath) {
    const aiPasteDir = path.join(process.cwd(), 'AI-paste');
    
    try {
        // Crea la cartella AI-paste se non esiste
        await fsPromises.mkdir(aiPasteDir, { recursive: true });
        
        // Pulisci la cartella esistente
        try {
            const existingFiles = await fsPromises.readdir(aiPasteDir);
            for (const file of existingFiles) {
                await fsPromises.unlink(path.join(aiPasteDir, file));
            }
        } catch (readError) {
            // Cartella vuota o non esistente, ignora
        }
        
        console.log(`\n📋 Copying ${filesToCopy.length} files to AI-paste/...`);
        
        let copiedCount = 0;
        let skippedCount = 0;
        
        for (const file of filesToCopy) {
            try {
                const destPath = path.join(aiPasteDir, file.fileName);
                
                // Gestisci conflitti di nome aggiungendo suffisso
                let finalDestPath = destPath;
                let counter = 1;
                while (fs.existsSync(finalDestPath)) {
                    const ext = path.extname(file.fileName);
                    const nameWithoutExt = path.basename(file.fileName, ext);
                    const newName = `${nameWithoutExt}_${counter}${ext}`;
                    finalDestPath = path.join(aiPasteDir, newName);
                    counter++;
                }
                
                await fsPromises.copyFile(file.sourcePath, finalDestPath);
                copiedCount++;
                
                // Stampa progress ogni 10 file
                if (copiedCount % 10 === 0) {
                    process.stdout.write(`\r📋 Copied ${copiedCount}/${filesToCopy.length} files...`);
                }
            } catch (copyError) {
                console.warn(`⚠️  Could not copy ${file.fileName}: ${copyError.message}`);
                skippedCount++;
            }
        }
        
        console.log(`\n✅ Files copied to AI-paste/:`);
        console.log(`   📄 Successfully copied: ${copiedCount} files`);
        if (skippedCount > 0) {
            console.log(`   ⚠️  Skipped: ${skippedCount} files (errors)`);
        }
        console.log(`   📁 Location: ${aiPasteDir}`);
        
    } catch (error) {
        console.error(`❌ Failed to create AI-paste directory: ${error.message}`);
    }
}

async function main() {
    const args = process.argv.slice(2);
    const targetPath = args[0] || process.cwd();
    const maxDepth = parseInt(args[1]) || 10;

    const fullPath = path.resolve(targetPath);

    if (!fs.existsSync(fullPath)) {
        console.error(`❌ Path does not exist: ${fullPath}`);
        process.exit(1);
    }

    if (!fs.statSync(fullPath).isDirectory()) {
        console.error(`❌ Path is not a directory: ${fullPath}`);
        process.exit(1);
    }

    const outFile = path.join(process.cwd(), 'project-structure.md');
    writeStream = fs.createWriteStream(outFile, { encoding: 'utf8' });

    printProjectInfo(fullPath);

    logLine(`📁 ${path.basename(fullPath)}/`);
    
    // ✅ Prima passata: raccogli solo i file da copiare
    const filesToCopy = [];
    analyzeDirectory(fullPath, '', maxDepth, 0, true, filesToCopy);
    
    // ✅ Seconda passata: stampa la struttura
    const analysis = analyzeDirectory(fullPath, '', maxDepth, 0, false, []);

    logLine(`\n${'='.repeat(50)}`);
    logLine(`📊 Summary:`);
    logLine(`   📄 Total files: ${analysis.totalFiles}`);
    logLine(`   💾 Total size: ${formatFileSize({ size: analysis.totalSize })}`);
    logLine(`${'='.repeat(50)}`);

    // Chiudi il file di output
    writeStream.end();

    console.log(`\n✅ Structure saved to: ${outFile}`);
    
    // ✅ Copia i file nella cartella AI-paste
    if (filesToCopy.length > 0) {
        await copyFilesToAIPaste(filesToCopy, fullPath);
    } else {
        console.log(`\n⚠️  No files to copy to AI-paste (all files excluded)`);
    }
}

// Handle command line execution
if (process.argv[1] === __filename) {
    main().catch(error => {
        console.error('❌ Script failed:', error);
        process.exit(1);
    });
}