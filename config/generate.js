const {
  readdirSync,
  statSync,
  writeFileSync,
  readJSONSync,
  writeJSONSync,
  ensureDirSync
} = require('fs-extra');
const { join, relative, dirname } = require('path');

const dirs = p =>
  readdirSync(p).filter(f => statSync(join(p, f)).isDirectory());
const packagesRoot = join(__dirname, '..', 'packages');
const currentDir = packagesRoot;
function work() {
  const directories = dirs(packagesRoot);
  // directories.forEach(name => ensureDirSync(join(__dirname, name)));
  const modules = ['es', 'lib'];
  modules.forEach(type => {
    const base = join(currentDir, `tsconfig.${type}.json`);
    const json = readJSONSync(base);
    json.references = [];
    directories.forEach(name => {
      //const base2 = join(packagesRoot, name, `tsconfig.${type}.json`);
      const base2 = join(currentDir, name, `tsconfig.${type}.json`);
      ensureDirSync(dirname(base2));
      writeFileSync(
        base2,
        template(
          type,
          relative(dirname(base2), base),
          relative(dirname(base2), join(packagesRoot, name)) || '.'
        )
      );
      json.references.push({ path: `./${relative(currentDir, base2)}` });
    });
    writeJSONSync(base, json);
  });
}

const template = (type, path, root) => `
{
  "extends": "${path}",
  "compilerOptions": {
    "rootDir": "${root}/src",
    "outDir": "${root}/${type}"
  },
  "include": ["${root}/src"]
}
`;

work();
