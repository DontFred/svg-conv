import parse, { Node } from "node-html-parser";
import { readdir } from "node:fs/promises";
import fs from "fs-extra";
import loading from "loading-cli";

const loader = loading("Loading icons").start();
type IconChildren = {
  tag: string;
  attributes: Record<string, string>;
  children: IconChildren[];
};

const files = await readdir("./icons", { recursive: true });

const svgFiles = files.filter((file) => file.endsWith(".svg"));
loader.info(`Found ${svgFiles.length} icons`);
const svgArray = Promise.all(
  svgFiles.map(async (file) => {
    const IconBuffer = await fs.readFile(`./icons/${file}`, "utf-8");
    const IconName = file.split(".svg")[0];
    const ParsedIcon = parse(IconBuffer);
    ParsedIcon.removeAttribute("xmlns");
    ParsedIcon.removeAttribute("xmlns:xlink");
    ParsedIcon.removeAttribute("version");
    ParsedIcon.removeAttribute("width");
    ParsedIcon.removeAttribute("height");
    const viewBoxRegex =
      /<svg .*?viewBox=["'](-?[\d\.]+[, ]+-?[\d\.]+[, ][\d\.]+[, ][\d\.]+)["']/;
    const styleRegex = /(?<=style=").*?(?=")/;
    loader.info(`Loading ${IconName}`);
    return {
      [IconName]: {
        viewBox: ParsedIcon.childNodes[0].toString().match(viewBoxRegex)?.[1],
        style: ParsedIcon.childNodes[0].toString().match(styleRegex)?.[0] ?? "",
        children: getChildren(ParsedIcon.childNodes[0]),
      },
    };
  })
);

const svgObject = Object.assign({}, ...(await svgArray));

function getChildren(item: Node): IconChildren[] {
  if (item.childNodes.length === 0) return [];

  return [
    ...item.childNodes
      .map((itemChildren) => {
        const rawAttributeRegex = new RegExp(
          `(?<=<${itemChildren.rawTagName}).*?(?=>)`
        );
        const kebabRegex = new RegExp(/(\w+)-(\w)([\w-]*)/g);
        const attributeRegex = new RegExp(/\s(\w+?)="(.+?)"/g);
        let rawAttribute =
          itemChildren.toString().match(rawAttributeRegex)?.[0] ?? "";

        const attributes: IconChildren["attributes"] = {};

        [...rawAttribute.matchAll(kebabRegex)].map((item) => {
          rawAttribute = rawAttribute.replace(
            item[0],
            item[0].replace(/-./g, (x) => x[1].toUpperCase())
          );
        });

        [...rawAttribute.matchAll(attributeRegex)].forEach((item) => {
          Object.assign(attributes, {
            [item[1]]: item[2],
          });
        });
        return {
          tag: itemChildren.rawTagName,
          attributes: attributes,
          children: getChildren(itemChildren),
        };
      })
      .filter((item) => item.tag !== ""),
  ];
}

const types = `export type Icons = \n\t${Object.keys(svgObject)
  .map((iconName) => `| "${iconName}" \n\t`)
  .join("")};`;

const icons = `export const icons = ${JSON.stringify(
  await svgObject,
  null,
  2
)};`;

await Bun.write("./icon/types.ts", types);
loader.info("Types file done");
await Bun.write("./icon/icons.ts", icons);
loader.info("Icons file done");

loader.succeed(
  `Found ${svgFiles.length} icons and added ${Object.keys(svgObject).length}`
);
