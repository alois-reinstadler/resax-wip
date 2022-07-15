import autoprefixer from 'autoprefixer';
import cssnano from 'cssnano';
import postcss from 'postcss';
import sass from 'sass';
import fs from 'fs/promises';

import { sync as glob } from 'glob';
import { join, normalize } from 'path';

import { workspaceRoot } from '@nrwl/devkit';
import projectConfig from './project.json';

const dest = projectConfig.targets['build-base'].options.outputPath;
const outDir = join(workspaceRoot, dest);

const processor = postcss([autoprefixer(), cssnano()]);
const processCss = ({ content, name, path }: ProcessCssArgs) =>
    processor.process(content, {
        from: path,
        to: join(workspaceRoot, dest, name),
        map: {
            inline: false,
        },
    });

interface ProcessCssArgs {
    name: string;
    path: string;
    content: string | Buffer;
}

const main = async () => {
    console.log(workspaceRoot);

    const pattern = join(__dirname, 'src/**/*.{css,scss,sass}');
    const filepaths = glob(pattern);
    const styles = toStyleInfo(...filepaths);

    if (!styles.length)
        return console.warn`No stylesheets found. Skipping CSS generation.`;

    for (const style of styles) {
        const { path, content, sourcemap } = await generateOutput(style);
        console.log(path + '.map', sourcemap);

        await emitFile(path, content);
        sourcemap && (await emitFile(path + '.map', sourcemap));
    }
};

main();

interface StyleInfo {
    path: string;
    name: string;
    file: string;
    dir: string;
    ext: string;
}

async function generateOutput(styleinfo: StyleInfo): Promise<StyleOutput> {
    const { name, dir, ext, path } = styleinfo;

    const isSass = /sass|scss/.exec(ext);
    const isSassModule = isSass && name.startsWith('_');

    const newExt = isSassModule ? ext : 'css';
    const newFile = [name, newExt].join('.');
    const newPath = join(outDir, dir, newFile);

    const _ = (content: string | Buffer, sourcemap?: string) => ({
        name,
        dir,
        ext: newExt,
        file: newFile,
        path: newPath,
        sourcemap,
        content,
    });

    if (isSassModule) return _(await fs.readFile(path));

    const content = isSass ? compileSass(path) : await fs.readFile(path);
    const result = await processCss({ content, name, path: newPath });

    const { css, map } = result;
    return _(css, map?.toString());
}

function compileSass(filepath: string, options?: sass.Options<'sync'>) {
    return sass.compile(filepath, options).css;
}

function emitFile(path: string, css: string | Buffer) {
    return fs.writeFile(path, css, { flag: 'w+' });
}

interface StyleOutput {
    dir: string;
    ext: string;
    name: string;
    file: string;
    content: string | Buffer;
    path: string;
    sourcemap?: string;
}

function toStyleInfo(...filepaths: string[]) {
    const results: StyleInfo[] = [];
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

function nrmlz(...paths: string[]) {
    return join(...paths).replace(/\\/g, '/');
}

// function getStylepaths()
