import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import mongoose from "mongoose";

// Schema inspection only: never open a database connection or read local credentials.
process.env.DOTENV_CONFIG_PATH = "__no_documentation_env__";
process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/gatherly_docs_unused";
process.env.MIDTRANS_SERVER_KEY = "documentation-placeholder";
const root=path.resolve(import.meta.dirname,"..");
const files=(dir:string):string[]=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?files(path.join(dir,entry.name)):[path.join(dir,entry.name)]);
for(const file of files(path.join(root,"src")).filter(file=>file.endsWith(".ts") && /\bmodel(?:<[^>]+>)?\(/.test(fs.readFileSync(file,"utf8")))) await import(pathToFileURL(file).href);
const rows=Object.values(mongoose.models).map(model=>({model:model.modelName,collection:model.collection.name,fields:Object.entries(model.schema.paths).filter(([name])=>!name.startsWith("__")).map(([name,p])=>({name,type:p.instance,ref:p.options.ref,enum:(p as unknown as {enumValues?:string[]}).enumValues})),indexes:model.schema.indexes()}));
console.log(JSON.stringify(rows.sort((a,b)=>a.model.localeCompare(b.model)),null,2));
