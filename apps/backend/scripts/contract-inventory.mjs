import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const parse = file => ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
const walk = (node, fn) => { fn(node); ts.forEachChild(node, child => walk(child, fn)); };
const files = dir => fs.readdirSync(dir, {withFileTypes:true}).flatMap(entry => entry.isDirectory() ? files(path.join(dir, entry.name)) : [path.join(dir,entry.name)]);
function literal(node, bindings = {}) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isIdentifier(node) && node.text in bindings) return bindings[node.text];
  if (ts.isTemplateExpression(node)) return node.head.text + node.templateSpans.map(span => literal(span.expression,bindings) + span.literal.text).join('');
  throw new Error(`Unresolved route expression: ${node.getText()}`);
}
function loopBindings(node) {
  let parent = node.parent;
  while(parent && !ts.isForOfStatement(parent)) parent = parent.parent;
  if(!parent) return [{}];
  let values=parent.expression;
  if(ts.isAsExpression(values)) values=values.expression;
  if(!ts.isArrayLiteralExpression(values)) throw new Error('Unsupported route loop');
  const name=parent.initializer.declarations[0].name;
  return values.elements.map(value => {
    if(ts.isIdentifier(name)) return {[name.text]:literal(value)};
    return Object.fromEntries(name.elements.map((element,index)=>[element.name.getText(), index===0 ? literal(value.elements[index]) : value.elements[index].getText()]));
  });
}
export function routeInventory() {
  const app=parse(path.join(root,'src/app.ts'));
  const mounts=new Map();
  walk(app,node=>{
    if(!ts.isCallExpression(node) || node.expression.getText(app)!=='app.use' || !ts.isStringLiteral(node.arguments[0]))return;
    for(const arg of node.arguments.slice(1)) if(ts.isIdentifier(arg) && arg.text.endsWith('Router')) mounts.set(arg.text,node.arguments[0].text);
  });
  const rows=[];
  for(const file of files(path.join(root,'src/modules')).filter(file=>file.endsWith('.ts'))) {
    const source=parse(file);
    walk(source,node=>{
      if(!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression))return;
      const method=node.expression.name.text, router=node.expression.expression.getText(source);
      if(!['get','post','put','patch','delete'].includes(method) || !mounts.has(router))return;
      for(const binding of loopBindings(node)) {
        const local=literal(node.arguments[0],binding);
        const full=(mounts.get(router)+ (local==='/'?'':local)).replace(/:([A-Za-z0-9_]+)/g,'{$1}');
        const text=node.getText(source);
        const statuses=[...text.matchAll(/\.(?:status|sendStatus)\((\d{3})\)/g)].map(match=>Number(match[1]));
        if(text.includes('.json(') && !statuses.some(status=>status>=200&&status<300))statuses.push(200);
        if(text.includes('.redirect('))statuses.push(302);
        rows.push({method,path:full.replace(/^\/api\/v1/,''),router,source:path.relative(root,file).replaceAll('\\','/'),line:source.getLineAndCharacterOfPosition(node.getStart()).line+1,statuses:[...new Set(statuses)].sort(),body:text.includes('.body'),multipart:/multipart|upload\.single/.test(text),query:[...new Set([...text.matchAll(/(?:req|request)\.query\.([\w]+)/g)].map(match=>match[1]))],errors:[...new Set([...text.matchAll(/new AppError\(\s*\d+\s*,\s*"([A-Z_]+)"/g)].map(match=>match[1]))]});
      }
    });
  }
  return rows.sort((a,b)=>a.path.localeCompare(b.path)||a.method.localeCompare(b.method));
}
if(process.argv[1]===fileURLToPath(import.meta.url)) console.log(JSON.stringify(routeInventory(),null,2));
