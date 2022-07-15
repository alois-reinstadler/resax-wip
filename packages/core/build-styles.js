const autoprefixer = require('autoprefixer');
const cssnano = require('cssnano');
const postcss = require('postcss').default;
const sass = require('sass');
const fs = require('fs-extra');
const glob = require('glob');

const { join } = require('path');
const { workspaceRoot } = require('@nrwl/devkit');

const dest = 'dist/packages/core';
const outDir = join(workspaceRoot, dest);
const processor = postcss([autoprefixer(), cssnano()]);

const main = async () => {
    const pattern = nrmlz(__dirname, 'src/**/*.{css,scss,sass}');
    const filepaths = glob.sync(pattern);
    const styles = toStyleInfo(...filepaths);

    if (!styles.length)
        return console.log('No stylesheets found. Skipping CSS generation.');

    let emitted = false;
    console.log(`Found ${styles.length} files for compilation.`);

    for (const style of styles) {
        const { name, dir, ext, path } = style;

        const isSass = /sass|scss/.exec(ext);
        const isSassModule = isSass && name.startsWith('_');

        const newExt = isSassModule ? ext : 'css';
        const newFile = [name, newExt].join('.');
        const newPath = join(outDir, dir, newFile);

        let content = '';
        let prevMap = '';

        if (isSass) {
            if (!isSassModule) {
                const result = compileSass(path);

                prevMap = JSON.stringify(result.sourceMap, undefined, 2);
                content = result.css;
            } else content = await rf(path);
        }

        if (content) {
            if (!isSassModule) {
                const result = await processCss({
                    content,
                    name,
                    path: newPath,
                    prev: prevMap,
                });
                content = result.css;

                if (content && result.map) {
                    content += `/*# sourceMappingURL=${encodeURIComponent(
                        newFile + '.map'
                    )} */`;
                    emit(newPath + '.map', result.map.toString());
                }
            }

            emit(newPath, content);
            emitted = true;
        }
    }
    console.log('Finished CSS generation.');
    !emitted && console.log('No files emited.');
};

main();

function compileSass(filepath) {
    return sass.compile(filepath, {
        sourceMap: true,
    });
}

async function rf(filepath) {
    return (await fs.readFile(filepath)).toString();
}

function emit(filepath, data) {
    return fs.outputFile(filepath, data);
}

function toStyleInfo(...filepaths) {
    const results = [];
    const projectRoot = nrmlz(__dirname);
    const rootSegments = projectRoot.split('/');

    for (const stylepath of filepaths) {
        const path = nrmlz(stylepath);
        const segments = path.split('/');

        const relPath = segments
            .filter((s) => !rootSegments.includes(s))
            .join('/');

        const file = segments.pop() || '';
        const ext = file.split('.').pop() || '';
        const name = file.replace('.' + ext, '');

        const dir = relPath.replace(file, '');

        results.push({
            path,
            name,
            file,
            dir,
            ext,
        });
    }

    return results;
}

function processCss({ content, name, path, prev }) {
    return processor.process(content, {
        from: path,
        to: join(workspaceRoot, dest, name),
        map: {
            inline: false,
            prev,
        },
    });
}

function nrmlz(...paths) {
    return join(...paths).replace(/\\/g, '/');
}
