const yaml = require("js-yaml");
const fs = require("fs").promises;
var path = require("path");

(async function() {
  // Get document, or throw exception on error
  const paths = (await fs.readdir("syntaxes")).filter(
    p => path.extname(p) === ".yaml" || path.extname(p) === ".yml"
  );
  for (p of paths) {
    const file = await fs.readFile(path.join("syntaxes", p), "utf8");
    await fs.writeFile(
      path.join("syntaxes", p.replace(path.extname(p), ".json")),
      JSON.stringify(yaml.safeLoad(file))
    );
  }
})();
