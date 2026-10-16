import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {handleApi} from './lib/api.js';
import {readFileSync,readdirSync} from 'node:fs';
function setup(){
 const raw=new DatabaseSync(':memory:');for(const file of readdirSync('drizzle').filter(x=>x.endsWith('.sql')))raw.exec(readFileSync('drizzle/'+file,'utf8'));
 const wrap=(sql,args=[])=>({bind(...values){return wrap(sql,values);},async first(){return raw.prepare(sql).get(...args)||null;},async all(){return {results:raw.prepare(sql).all(...args)};},async run(){const r=raw.prepare(sql).run(...args);return {meta:{changes:Number(r.changes)}};}});
 const objects=new Map();return {DB:{prepare:wrap,async batch(statements){raw.exec('BEGIN');try{const result=[];for(const s of statements)result.push(await s.run());raw.exec('COMMIT');return result;}catch(e){raw.exec('ROLLBACK');throw e;}}},BUCKET:{async put(k,b,o){objects.set(k,{b,o});},async delete(keys){for(const k of Array.isArray(keys)?keys:[keys])objects.delete(k);}},objects,raw};
}
function req(path,method='GET',data,owner=false,origin='https://portfolio.test'){
 const headers={};if(method!=='GET'){headers.origin=origin;headers['content-type']='application/json';}if(owner){headers['oai-authenticated-user-id']='test-owner';headers['oai-authenticated-user-email']='podyma.marcin33@gmail.com';}
 return new Request('https://portfolio.test'+path,{method,headers,body:data===undefined?undefined:JSON.stringify(data)});
}
test('owner authorization, durable CRUD, images and contact inbox',async()=>{
 const env=setup();
 assert.equal((await handleApi(req('/api/photos','POST',{},false),env)).status,401);
 assert.equal((await handleApi(req('/api/photos','POST',{},true,'https://evil.test'),env)).status,403);
 assert.equal((await handleApi(req('/api/messages'),env)).status,401);
 const first=await (await handleApi(req('/api/photos'),env)).json();assert.ok(first.length>0);
 const again=await (await handleApi(req('/api/photos'),env)).json();assert.equal(first.length,again.length);
 const payload={category:'nature',venue:'Warszawa',title:'Test zdjęcia',image:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZlS8AAAAASUVORK5CYII='};
 const response=await handleApi(req('/api/photos','POST',payload,true),env);assert.equal(response.status,201);const item=await response.json();assert.ok(item.src.startsWith('/media/'));assert.equal(env.objects.size,1);
 const update=await handleApi(req('/api/photos/'+item.id,'PUT',{category:'nature',venue:'Kraków',title:'Zmienione'},true),env);assert.equal(update.status,200);
 assert.equal((await (await handleApi(req('/api/photos'),env)).json()).find(x=>x.id===item.id).venue,'Kraków');
 const projectResponse=await handleApi(req('/api/projects','POST',{section:'projects',title:'Projekt testowy',summary:'Opis',description:'Treść',year:2026},true),env);assert.equal(projectResponse.status,201);const project=await projectResponse.json();
 assert.equal((await handleApi(req('/api/projects/'+project.id,'DELETE',{},true),env)).status,200);
 assert.equal((await handleApi(req('/api/photos/'+item.id,'DELETE',{},true),env)).status,200);
 const requestId=crypto.randomUUID(),contact={requestId,email:'test@example.com',category:'it',details:'web',message:'Test zapisu wiadomości online.'};
 assert.equal((await handleApi(req('/api/contact','POST',contact),env)).status,201);
 assert.equal((await handleApi(req('/api/contact','POST',contact),env)).status,200);
 const inbox=await (await handleApi(req('/api/messages','GET',undefined,true),env)).json();assert.equal(inbox.items.length,1);assert.equal(inbox.unread,1);
 assert.equal((await handleApi(req('/api/messages/'+requestId,'PUT',{read:true},true),env)).status,200);
 assert.equal((await (await handleApi(req('/api/messages','GET',undefined,true),env)).json()).unread,0);
 for(let i=0;i<4;i++)assert.equal((await handleApi(req('/api/contact','POST',{...contact,requestId:crypto.randomUUID()}),env)).status,201);
 assert.equal((await handleApi(req('/api/contact','POST',{...contact,requestId:crypto.randomUUID()}),env)).status,429);
 env.raw.close();
});
