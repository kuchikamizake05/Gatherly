import { mountedOperations } from "./mounted-operations.js";

type Operation = Record<string, any>;
const str = { type: "string" };
const object = (properties: Record<string, unknown>, required: string[] = []) => ({ type: "object", properties, required });
const password = { type: "string", minLength: 12, maxLength: 128 };
const id = { type: "string", pattern: "^[a-fA-F0-9]{24}$" };
const note = { type: "string", minLength: 5, maxLength: 2000 };
const username={type:"string",minLength:3,maxLength:40,pattern:"^[a-z0-9][a-z0-9._-]*$"};
const ticketInput=object({name:{type:"string",minLength:2,maxLength:80},description:{type:"string",maxLength:500},price:{type:"integer",minimum:0},capacity:{type:"integer",minimum:1},salesStartsAt:{type:"string",format:"date-time"},salesEndsAt:{type:"string",format:"date-time"}},["name","price","capacity","salesStartsAt","salesEndsAt"]);
const eventInput=object({title:{type:"string",minLength:2,maxLength:160},description:{type:"string",minLength:1,maxLength:5000},category:{type:"string",minLength:2,maxLength:80},startsAt:{type:"string",format:"date-time"},endsAt:{type:"string",format:"date-time"},timezone:str,venueName:{type:"string",minLength:2,maxLength:160},address:{type:"string",minLength:2,maxLength:300},city:{type:"string",minLength:2,maxLength:100},posterAssetId:str,locationType:{type:"string",enum:["offline","online"],default:"offline"},terms:{type:"array",maxItems:30,items:{type:"string",minLength:1,maxLength:1000}},performerLabel:{type:"string",minLength:1,maxLength:80},performers:{type:"array",maxItems:100,items:object({name:{type:"string",minLength:1,maxLength:100},note:{type:"string",maxLength:500},time:{type:"string",maxLength:30},photoAssetId:str,photoUrl:{type:"string",format:"uri"}},["name"])},showRemaining:{type:"boolean",default:true},checkInOpensAt:{type:"string",format:"date-time"},checkInClosesAt:{type:"string",format:"date-time"}},["title","description","category","startsAt","endsAt","timezone","venueName","address","city"]);
const applicationInput=object({organizerName:{type:"string",minLength:2,maxLength:150},organizerType:{type:"string",enum:["komunitas","organisasi_kampus","perusahaan","individu"]},description:{type:"string",minLength:10,maxLength:2000},address:object({province:{type:"string",minLength:1,maxLength:100},city:{type:"string",minLength:1,maxLength:100},street:{type:"string",minLength:5,maxLength:500},postalCode:{type:"string",pattern:"^\\d{5}$"}},["province","city","street","postalCode"]),links:{type:"array",maxItems:5,items:object({type:{type:"string",enum:["instagram","tiktok","youtube","website","lainnya"]},url:{type:"string",minLength:3,maxLength:500,description:"javascript: dan data: ditolak"}},["type","url"])},pic:object({name:{type:"string",minLength:2,maxLength:100},role:{type:"string",minLength:1,maxLength:100},email:{type:"string",format:"email"},phone:{type:"string",minLength:8,maxLength:30}},["name","role","email","phone"]),username,ktp:{type:"string",minLength:1},legalDocument:{type:"string",minLength:1,nullable:true}},["organizerName","organizerType","description","address","links","pic","username","ktp"]);
const bodies: Record<string, unknown> = {
  "post /organizer/events":eventInput,
  "patch /organizer/events/{id}":{...eventInput,required:[],properties:{...eventInput.properties,salesClosed:{type:"boolean"}}},
  "post /organizer/events/{id}/ticket-types":ticketInput,
  "patch /organizer/events/{id}/ticket-types/{typeId}":{...ticketInput,required:[]},
  "post /organizer-applications":{...applicationInput,additionalProperties:false},
  "post /organizer-applications/{number}/fix":{...applicationInput,required:[],additionalProperties:false,description:"Subset field yang ditandai; cookie edit valid dan status needs_fix wajib."},
  "post /organizer/team":object({name:{type:"string",minLength:1,maxLength:100},username,eventIds:{type:"array",maxItems:100,items:str}},["name","username","eventIds"]),
  "put /organizer/team/{id}/assignments":object({eventIds:{type:"array",maxItems:100,items:str}},["eventIds"]),
  "post /orders":object({ticketTypeId:id,quantity:{type:"integer",minimum:1,maximum:4},contactPhone:{type:"string",maxLength:30},attendees:{type:"array",minItems:1,maxItems:4,items:object({name:{type:"string",minLength:2,maxLength:100},email:{type:"string",format:"email",maxLength:254},phone:{type:"string",maxLength:30},birthDate:{type:"string",pattern:"^\\d{4}-\\d{2}-\\d{2}$"}},["name"])}},["ticketTypeId","quantity","attendees"]),
  "post /orders/{id}/payment-session":object({method:{type:"string",maxLength:30}}),
  "post /organizer/events/{id}/cancel":object({confirmTitle:str,reason:{type:"string",minLength:10,maxLength:1000}},["confirmTitle","reason"]),
  "post /admin/auth/login": object({email:{type:"string",format:"email",description:"Domain gatherly.xyz"},password:{type:"string",minLength:1,maxLength:128}},["email","password"]),
  "post /admin/auth/totp": object({challengeId:{type:"string",minLength:20},code:{type:"string",minLength:6,maxLength:128},rememberDevice:{type:"boolean"}},["challengeId","code"]),
  "post /admin/auth/backup-code": object({challengeId:{type:"string",minLength:20},code:{type:"string",minLength:6,maxLength:128},rememberDevice:{type:"boolean"}},["challengeId","code"]),
  "post /workspace/auth/login": object({username:{type:"string",minLength:3,maxLength:40,pattern:"^[a-z0-9][a-z0-9._-]*$"},password:{type:"string",minLength:1,maxLength:128}},["username","password"]),
  "post /workspace/auth/password/forgot":object({usernameOrEmail:str},["usernameOrEmail"]),
  "post /workspace/auth/password/reset":object({token:{type:"string",minLength:20},password},["token","password"]),
  "post /workspace/auth/password/first":object({newPassword:password},["newPassword"]),
  "post /workspace/auth/password":object({currentPassword:str,newPassword:password},["currentPassword","newPassword"]),
  "patch /account":object({name:{type:"string",minLength:2,maxLength:100},phone:{type:"string",nullable:true,pattern:"^\\+?[\\d\\s()-]{7,25}$"}},["name","phone"]),
  "post /account/password":object({currentPassword:str,newPassword:password},["newPassword"]),
  "patch /account/notifications":object({reminders:{type:"boolean"},recommendations:{type:"boolean"}},["reminders","recommendations"]),
  "post /account/delete":object({confirmation:{type:"string",description:"hapus atau hapus akun"}},["confirmation"]),
  "post /auth/password/forgot":object({email:{type:"string",format:"email"}},["email"]),
  "post /auth/password/reset":object({token:{type:"string",minLength:32,maxLength:256},password},["token","password"]),
  "post /organizer-applications/lookup":object({number:str,email:{type:"string",format:"email"}},["number","email"]),
  "post /admin/applications/{id}/request-fix":object({flags:{type:"array",minItems:1,maxItems:10,items:object({field:{type:"string",enum:["organizerName","organizerType","description","address","links","pic","username","ktp","legalDocument"]},note:{type:"string",minLength:1,maxLength:1000}},["field","note"])}},["flags"]),
  "post /admin/applications/{id}/reject":object({reason:{type:"string",minLength:5,maxLength:2000}},["reason"]),
  "post /admin/organizers/{id}/freeze":object({reason:note},["reason"]),
  "post /admin/reports/{id}/close":object({note:{type:"string",minLength:1,maxLength:2000}},["note"]),
  "post /admin/payouts/{id}/transferred":object({transferReference:{type:"string",minLength:3,maxLength:200},transferredAt:{type:"string",format:"date-time",description:"Tidak sebelum requestedAt atau di masa depan"}},["transferReference","transferredAt"]),
  "post /refunds/orders/{orderId}":object({reason:{type:"string",minLength:10,maxLength:1000},ticketIds:{type:"array",minItems:1,maxItems:4,items:id}},["reason"]),
  "post /admin/refunds/{id}/decision":object({approve:{type:"boolean"},note:{type:"string",minLength:3,maxLength:1000}},["approve","note"]),
  "post /admin/cancellations/{id}/decision":object({approve:{type:"boolean"},note:{type:"string",minLength:3,maxLength:1000}},["approve","note"]),
  "post /admin/refunds/{id}/transferred":object({transferReference:{type:"string",minLength:3,maxLength:200},transferredAt:{type:"string",format:"date-time"}},["transferReference","transferredAt"]),
  "post /organizer/payouts":object({eventId:id},["eventId"]),
  "put /organizer/bank-account":object({bank:{type:"string",minLength:2,maxLength:80},accountNumber:{type:"string",pattern:"^\\d{5,30}$"},holderName:{type:"string",minLength:2,maxLength:100}},["bank","accountNumber","holderName"]),
  "post /events/{slug}/reports":object({reason:{type:"string",enum:["fraud","wrong_info","inappropriate","other"]},note:{type:"string",maxLength:1000}},["reason"]),
  "post /committee/events/{eventId}/check-ins":{...object({qrPayload:{type:"string",pattern:"^gatherly:v1:[A-Za-z0-9_-]{43}$"},ticketCode:{type:"string",minLength:1,maxLength:40}}),additionalProperties:false,oneOf:[{required:["qrPayload"]},{required:["ticketCode"]}]},
};

function access(route: typeof mountedOperations[number]): {security:Operation[];description:string} {
  const key=`${route.method} ${route.path}`;
  if(route.path.startsWith('/admin/auth/') && !['/admin/auth/me','/admin/auth/logout'].includes(route.path))return {security:[],description:'Challenge admin, tanpa cookie sesi. Rate limit database berlaku.'};
  if(route.path.startsWith('/admin/'))return {security:[{adminCookie:[],...(route.method==='get'?{}:{csrfToken:[]})}],description:'Sesi admin aktif. Mutasi memerlukan X-CSRF-Token.'};
  if(route.path.startsWith('/workspace/auth/') && ['/workspace/auth/login','/workspace/auth/password/forgot','/workspace/auth/password/reset'].includes(route.path))return {security:[],description:'Tanpa sesi workspace. Rate limit database berlaku.'};
  if(route.path.startsWith('/workspace/') || route.router==='teamRouter' || route.router==='organizerProfileRouter')return {security:[{workspaceCookie:[],...(route.method==='get'?{}:{csrfToken:[]})}],description:'Sesi workspace aktif; team/profile hanya organizer. Mutasi diperiksa CSRF dan status frozen.'};
  if(['publicEventRouter','publicOrganizerRouter','applicationRouter','mediaRouter'].includes(route.router)||route.path.startsWith('/tickets/shared/')||route.router==='paymentRouter'||(route.router==='authRouter'&&!['/auth/me','/auth/logout'].includes(route.path))||route.router==='participantPasswordRouter')return {security:[],description:route.router==='paymentRouter'?'Tanpa sesi, signature/nominal/status Midtrans diverifikasi server.':route.path.startsWith('/tickets/shared/')?'Tanpa login; token URL adalah credential rahasia.':'Publik; validasi dan pemeriksaan Origin mengikuti handler. Cookie buyer opsional untuk saved pada katalog.'};
  const buyer={cookieAuth:[],...(route.method==='get'?{}:{csrfToken:[]})};
  const workspaceAllowed=/^\/(organizer(?:\/|$)|committee(?:\/|$)|realtime(?:\/|$))/.test(route.path);
  return {security:workspaceAllowed?[buyer,{workspaceCookie:[],...(route.method==='get'?{}:{csrfToken:[]})}]:[buyer],description:workspaceAllowed?'Sesi buyer atau workspace; organizer/assignment diperiksa sesuai resource. Mutasi memerlukan CSRF.':'Sesi buyer; kepemilikan resource diperiksa. Mutasi memerlukan CSRF.'};
}

export function currentPaths(previous: Record<string, any>): Record<string, any> {
  const paths:Record<string,any>={};
  for(const route of mountedOperations){
    const shape=(path:string)=>path.replace(/\{\w+\}/g,'{}');
    const legacyPath=Object.keys(previous).find(path=>shape(path)===shape(route.path));
    const legacy=previous[legacyPath??route.path]?.[route.method]??{};
    const key=`${route.method} ${route.path}`;
    const auth=access(route);
    const statuses= key==='post /orders'?[200,201]: key==='post /organizers'?[403]:route.path==='/auth/google'?[302,503]:route.statuses.length?route.statuses:[200];
    const responses:Record<string,any>={};
    for(const status of statuses)responses[status]={description:status===204?'Sukses tanpa body':status===302?'Redirect':status===403?'APPLICATION_REQUIRED':status===202?'Challenge atau pemrosesan belum selesai':'Respons handler; bentuk DTO dijelaskan di docs/api-contract.md',...(status!==204&&status!==302?{content:{[route.path.endsWith('.csv')?'text/csv':'application/json']:{schema:route.path.endsWith('.csv')?{type:'string'}:{type:'object',additionalProperties:true}}}}:{})};
    responses.default={description:'Error validasi, autentikasi, hak akses, konflik atau layanan. Lihat kontrak dan handler.',content:{'application/json':{schema:{$ref:'#/components/schemas/ErrorResponse'}}}};
    const parameters:Operation[]=[...route.path.matchAll(/\{(\w+)\}/g)].map(match=>({in:'path',name:match[1],required:true,schema:str}));
    for(const parameter of legacy.parameters??[])if(parameter.in!=='path'&&!parameters.some(p=>p.in===parameter.in&&p.name===parameter.name))parameters.push(parameter);
    for(const name of route.query)if(!parameters.some(p=>p.in==='query'&&p.name===name))parameters.push({in:'query',name,schema:str});
    if(key==='post /orders'&&!parameters.some(p=>p.name==='Idempotency-Key'))parameters.push({in:'header',name:'Idempotency-Key',required:true,schema:{type:'string',format:'uuid'}});
    const schema=bodies[key]??legacy.requestBody?.content?.['application/json']?.schema;
    const operation:Operation={...legacy,tags:[route.router.replace(/Router$/,'')],summary:`${route.method.toUpperCase()} ${route.path}`,description:`${auth.description}\n\nSumber: ${route.source}:${route.line}. Kode error langsung handler: ${route.errors.join(', ')||'lihat service dan middleware'}. Skema respons terbuka bukan jaminan semua field; lihat DTO dan kontrak.`,security:auth.security,parameters,responses,'x-source':`${route.source}:${route.line}`};
    if(route.body||route.multipart)operation.requestBody={required:Boolean((schema as {required?:string[]}|undefined)?.required?.length),content:{[route.multipart?'multipart/form-data':'application/json']:{schema:route.multipart?object({file:{type:'string',format:'binary'}}):schema??{type:'object',additionalProperties:true,description:'Field dan validasi mengikuti Zod pada sumber handler; lihat docs/api-contract.md.'}}}};
    else delete operation.requestBody;
    (paths[route.path]??={})[route.method]=operation;
  }
  for(const name of ['/health','/internal/maintenance'])if(previous[name])paths[name]=previous[name];
  return paths;
}
