import * as fs from 'fs';
import * as path from 'path';
import type { CodebaseSummary } from './types';

/** Directories to skip during file tree traversal. */
const SKIP_DIRS = new Set([
    'node_modules', '.git', 'dist', 'out', 'build', '__pycache__',
    'target', '.next', '.vscode', '.idea', 'coverage', '.cache',
    'bin', 'obj', '.venv', 'venv', '.tox', '.mypy_cache',
]);

/** Maximum depth for file tree traversal. */
const MAX_DEPTH = 4;

/** Maximum number of entries in the file tree before truncation. */
const MAX_TREE_ENTRIES = 200;

/**
 * Well-known config files that indicate a language/ecosystem.
 * Maps filename → language name.
 */
const LANGUAGE_INDICATORS: Record<string, string> = {
    'package.json': 'JavaScript/TypeScript',
    'tsconfig.json': 'TypeScript',
    'Cargo.toml': 'Rust',
    'pyproject.toml': 'Python',
    'setup.py': 'Python',
    'requirements.txt': 'Python',
    'go.mod': 'Go',
    'pom.xml': 'Java',
    'build.gradle': 'Java',
    'build.gradle.kts': 'Java/Kotlin',
    'Gemfile': 'Ruby',
    'composer.json': 'PHP',
};

/**
 * Well-known entry point files to look for.
 */
const ENTRY_POINT_FILES = [
    'main.ts', 'index.ts', 'app.ts', 'server.ts',
    'main.js', 'index.js', 'app.js', 'server.js',
    'src/main.ts', 'src/index.ts', 'src/app.ts',
    'src/main.js', 'src/index.js', 'src/app.js',
    'src/main.py', 'src/lib.rs', 'main.py', 'app.py',
    'main.go', 'cmd/main.go',
    'src/main.rs', 'src/lib.rs',
    'Program.cs',
];

/**
 * Framework detection patterns: key in dependencies → framework name.
 */
const FRAMEWORK_PATTERNS: Record<string, string> = {
    'react': 'React',
    'react-dom': 'React',
    'next': 'Next.js',
    'vue': 'Vue',
    '@angular/core': 'Angular',
    'express': 'Express',
    'fastify': 'Fastify',
    'koa': 'Koa',
    'nestjs': 'NestJS',
    '@nestjs/core': 'NestJS',
    'django': 'Django',
    'flask': 'Flask',
    'fastapi': 'FastAPI',
    'spring-boot': 'Spring Boot',
    'actix-web': 'Actix Web',
    'rocket': 'Rocket',
    'gin': 'Gin',
    'fiber': 'Fiber',
    'rails': 'Ruby on Rails',
    'sinatra': 'Sinatra',
    'laravel': 'Laravel',
    'symfony': 'Symfony',
};

/**
 * Test framework detection patterns: key in dependencies → test framework name.
 */
const TEST_FRAMEWORK_PATTERNS: Record<string, string> = {
    'jest': 'Jest',
    'mocha': 'Mocha',
    'vitest': 'Vitest',
    '@vue/test-utils': 'Vue Test Utils',
    'pytest': 'pytest',
    'unittest': 'unittest',
    'junit': 'JUnit',
    'cargo test': 'cargo test',
    'go test': 'go test',
    'rspec': 'RSpec',
    'phpunit': 'PHPUnit',
};

/**
 * Explore a project directory and build a structured CodebaseSummary.
 *
 * If the directory doesn't exist or isn't a directory, returns a minimal
 * empty summary (for greenfield projects with no codebase).
 *
 * @param projectRoot - Absolute path to the project root directory.
 * @returns A CodebaseSummary describing the project.
 */
export function exploreCodebase(projectRoot: string): CodebaseSummary {
    // Graceful handling for non-existent or non-directory paths
    if (!fs.existsSync(projectRoot) || !fs.statSync(projectRoot).isDirectory()) {
        return createEmptySummary();
    }

    try {
        const languages = detectLanguages(projectRoot);
        const frameworks = detectFrameworks(projectRoot);
        const fileTree = buildFileTree(projectRoot);
        const entryPoints = findEntryPoints(projectRoot);
        const conventions = detectConventions(projectRoot);
        const testFramework = detectTestFramework(projectRoot);
        const configFiles = findConfigFiles(projectRoot);
        const directoryStructure = describeDirectoryStructure(projectRoot);

        return {
            languages,
            frameworks,
            directoryStructure,
            entryPoints,
            conventions,
            testFramework,
            configFiles,
            fileTree,
        };
    } catch {
        // If anything goes wrong during exploration, return empty summary
        return createEmptySummary();
    }
}

function createEmptySummary(): CodebaseSummary {
    return {
        languages: [],
        frameworks: [],
        directoryStructure: '',
        entryPoints: [],
        conventions: [],
        configFiles: [],
        fileTree: '',
    };
}

/**
 * Detect programming languages based on config files present in the project root.
 */
function detectLanguages(projectRoot: string): string[] {
    const languages = new Set<string>();

    for (const [filename, language] of Object.entries(LANGUAGE_INDICATORS)) {
        if (fs.existsSync(path.join(projectRoot, filename))) {
            languages.add(language);
        }
    }

    // Refine: if both package.json and tsconfig.json exist, it's TypeScript (not JS/TS)
    if (languages.has('TypeScript') && languages.has('JavaScript/TypeScript')) {
        languages.delete('JavaScript/TypeScript');
    }

    return Array.from(languages);
}

/**
 * Detect frameworks from package.json dependencies.
 */
function detectFrameworks(projectRoot: string): string[] {
    const frameworks = new Set<string>();

    const pkgJsonPath = path.join(projectRoot, 'package.json');
    if (fs.existsSync(pkgJsonPath)) {
        try {
            const content = fs.readFileSync(pkgJsonPath, 'utf-8');
            const pkg = JSON.parse(content);
            const allDeps = {
                ...(pkg.dependencies ?? {}),
                ...(pkg.devDependencies ?? {}),
                ...(pkg.peerDependencies ?? {}),
            };

            for (const [dep, frameworkName] of Object.entries(FRAMEWORK_PATTERNS)) {
                if (dep in allDeps) {
                    frameworks.add(frameworkName);
                }
            }
        } catch {
            // Invalid package.json — skip framework detection
        }
    }

    // Python framework detection from requirements.txt / pyproject.toml
    const reqFiles = ['requirements.txt', 'pyproject.toml', 'Pipfile'];
    for (const reqFile of reqFiles) {
        const reqPath = path.join(projectRoot, reqFile);
        if (fs.existsSync(reqPath)) {
            try {
                const content = fs.readFileSync(reqPath, 'utf-8').toLowerCase();
                for (const [dep, frameworkName] of Object.entries(FRAMEWORK_PATTERNS)) {
                    if (content.includes(dep.toLowerCase())) {
                        frameworks.add(frameworkName);
                    }
                }
            } catch {
                // Skip
            }
        }
    }

    return Array.from(frameworks);
}

/**
 * Build a recursive file tree string, skipping common noise directories.
 */
function buildFileTree(projectRoot: string): string {
    const lines: string[] = [];
    buildTreeRecursive(projectRoot, '', 0, lines);
    return lines.join('\n');
}

function buildTreeRecursive(dir: string, prefix: string, depth: number, lines: string[]): void {
    if (depth > MAX_DEPTH || lines.length > MAX_TREE_ENTRIES) {
        return;
    }

    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return;
    }

    // Sort: directories first, then files, both alphabetically
    entries.sort((a, b) => {
        if (a.isDirectory() && !b.isDirectory()) return -1;
        if (!a.isDirectory() && b.isDirectory()) return 1;
        return a.name.localeCompare(b.name);
    });

    for (const entry of entries) {
        if (lines.length > MAX_TREE_ENTRIES) {
            lines.push(`${prefix}... (truncated)`);
            return;
        }

        const name = entry.name;

        // Skip noise directories
        if (entry.isDirectory() && SKIP_DIRS.has(name)) {
            continue;
        }

        // Skip hidden files/dirs (except .github which can be useful)
        if (name.startsWith('.') && name !== '.github') {
            continue;
        }

        if (entry.isDirectory()) {
            lines.push(`${prefix}${name}/`);
            buildTreeRecursive(
                path.join(dir, name),
                prefix + '  ',
                depth + 1,
                lines
            );
        } else {
            lines.push(`${prefix}${name}`);
        }
    }
}

/**
 * Find entry point files in the project.
 */
function findEntryPoints(projectRoot: string): string[] {
    const found: string[] = [];

    for (const candidate of ENTRY_POINT_FILES) {
        const fullPath = path.join(projectRoot, candidate);
        if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
            found.push(candidate);
        }
    }

    // Also check package.json "main" field
    const pkgJsonPath = path.join(projectRoot, 'package.json');
    if (fs.existsSync(pkgJsonPath)) {
        try {
            const content = fs.readFileSync(pkgJsonPath, 'utf-8');
            const pkg = JSON.parse(content);
            if (pkg.main && !found.includes(pkg.main)) {
                found.push(pkg.main);
            }
        } catch {
            // Skip
        }
    }

    return found;
}

/**
 * Detect naming and organizational conventions from the file tree.
 */
function detectConventions(projectRoot: string): string[] {
    const conventions: string[] = [];

    // Check naming convention
    const files = listFilesFlat(projectRoot, 2);
    const hasKebab = files.some(f => f.includes('-') && f === f.toLowerCase());
    const hasCamel = files.some(f => /^[a-z][a-zA-Z0-9]*\.(ts|js|py|rs|go)$/.test(path.basename(f)));
    const hasSnake = files.some(f => /_[a-z]/.test(path.basename(f)) && path.basename(f) === path.basename(f).toLowerCase());
    const hasPascal = files.some(f => /^[A-Z][a-zA-Z0-9]*\.(ts|js|py|rs|go)$/.test(path.basename(f)));

    if (hasKebab) { conventions.push('File naming: kebab-case'); }
    if (hasCamel) { conventions.push('File naming: camelCase'); }
    if (hasSnake) { conventions.push('File naming: snake_case'); }
    if (hasPascal) { conventions.push('File naming: PascalCase'); }

    // Check organizational pattern
    try {
        const topDirs = fs.readdirSync(projectRoot, { withFileTypes: true })
            .filter(d => d.isDirectory() && !d.name.startsWith('.') && !SKIP_DIRS.has(d.name))
            .map(d => d.name);

        const featureDirs = ['features', 'modules', 'domains', 'packages'];
        const typeDirs = ['components', 'services', 'utils', 'helpers', 'controllers', 'models', 'views'];

        if (topDirs.some(d => featureDirs.includes(d.toLowerCase()))) {
            conventions.push('Organization: by feature');
        }
        if (topDirs.some(d => typeDirs.includes(d.toLowerCase()))) {
            conventions.push('Organization: by type');
        }
        if (topDirs.includes('src')) {
            conventions.push('Has src/ directory');
        }
    } catch {
        // Skip
    }

    // Check for linting config
    const lintFiles = ['.eslintrc', '.eslintrc.js', '.eslintrc.json', '.eslintrc.yml',
        'eslint.config.js', 'eslint.config.mjs', '.prettierrc', '.prettierrc.json',
        'pyproject.toml', 'ruff.toml', '.flake8', 'clippy.toml'];
    for (const lf of lintFiles) {
        if (fs.existsSync(path.join(projectRoot, lf))) {
            conventions.push(`Linting config: ${lf}`);
            break;
        }
    }

    return conventions;
}

/**
 * Detect test framework from config files.
 */
function detectTestFramework(projectRoot: string): string | undefined {
    // Check package.json for JS/TS test frameworks
    const pkgJsonPath = path.join(projectRoot, 'package.json');
    if (fs.existsSync(pkgJsonPath)) {
        try {
            const content = fs.readFileSync(pkgJsonPath, 'utf-8');
            const pkg = JSON.parse(content);
            const allDeps = {
                ...(pkg.dependencies ?? {}),
                ...(pkg.devDependencies ?? {}),
            };
            for (const [dep, framework] of Object.entries(TEST_FRAMEWORK_PATTERNS)) {
                if (dep in allDeps) {
                    return framework;
                }
            }
        } catch {
            // Skip
        }
    }

    // Check for Python test frameworks
    const reqFiles = ['requirements.txt', 'pyproject.toml'];
    for (const reqFile of reqFiles) {
        const reqPath = path.join(projectRoot, reqFile);
        if (fs.existsSync(reqPath)) {
            try {
                const content = fs.readFileSync(reqPath, 'utf-8').toLowerCase();
                if (content.includes('pytest')) return 'pytest';
                if (content.includes('unittest')) return 'unittest';
            } catch {
                // Skip
            }
        }
    }

    // Check for Go test files
    if (fs.existsSync(path.join(projectRoot, 'go.mod'))) {
        return 'go test';
    }

    // Check for Rust test convention
    if (fs.existsSync(path.join(projectRoot, 'Cargo.toml'))) {
        return 'cargo test';
    }

    // Check for test directories
    const testDirs = ['test', 'tests', '__tests__', 'spec', 'specs'];
    for (const td of testDirs) {
        if (fs.existsSync(path.join(projectRoot, td))) {
            return 'detected (unknown framework)';
        }
    }

    return undefined;
}

/**
 * Find key config files in the project root.
 */
function findConfigFiles(projectRoot: string): string[] {
    const wellKnownConfigs = [
        'package.json', 'tsconfig.json', 'jsconfig.json',
        'Cargo.toml', 'pyproject.toml', 'setup.py', 'setup.cfg',
        'go.mod', 'pom.xml', 'build.gradle', 'build.gradle.kts',
        'Gemfile', 'composer.json',
        '.eslintrc', '.eslintrc.js', '.eslintrc.json', 'eslint.config.js',
        '.prettierrc', '.prettierrc.json',
        'webpack.config.js', 'webpack.config.ts', 'vite.config.ts', 'vite.config.js',
        'rollup.config.js', 'esbuild.config.js',
        'docker-compose.yml', 'docker-compose.yaml', 'Dockerfile',
        '.env.example', '.github/workflows',
        'Makefile', 'justfile', 'Taskfile.yml',
        'turbo.json', 'nx.json', 'lerna.json',
    ];

    return wellKnownConfigs.filter(name =>
        fs.existsSync(path.join(projectRoot, name))
    );
}

/**
 * Describe the top-level directory structure in prose.
 */
function describeDirectoryStructure(projectRoot: string): string {
    try {
        const entries = fs.readdirSync(projectRoot, { withFileTypes: true })
            .filter(e => !e.name.startsWith('.') && !SKIP_DIRS.has(e.name))
            .sort((a, b) => a.name.localeCompare(b.name));

        const dirs = entries.filter(e => e.isDirectory()).map(e => e.name);
        const files = entries.filter(e => e.isFile()).map(e => e.name);

        const parts: string[] = [];
        if (dirs.length > 0) {
            parts.push(`Directories: ${dirs.join(', ')}`);
        }
        if (files.length > 0) {
            parts.push(`Files: ${files.join(', ')}`);
        }
        return parts.join('. ') || 'Empty directory';
    } catch {
        return 'Unable to read directory';
    }
}

/**
 * List files flat up to a given depth (helper for convention detection).
 */
function listFilesFlat(dir: string, maxDepth: number): string[] {
    const result: string[] = [];

    function walk(current: string, depth: number): void {
        if (depth > maxDepth) return;
        try {
            const entries = fs.readdirSync(current, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.isDirectory() && !SKIP_DIRS.has(entry.name) && !entry.name.startsWith('.')) {
                    walk(path.join(current, entry.name), depth + 1);
                } else if (entry.isFile()) {
                    result.push(entry.name);
                }
            }
        } catch {
            // Skip unreadable directories
        }
    }

    walk(dir, 0);
    return result;
}
