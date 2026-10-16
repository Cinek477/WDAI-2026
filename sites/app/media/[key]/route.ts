import {env} from 'cloudflare:workers';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 const key=new URL(request.url).pathname.slice('/media/'.length);
 if(!/^[a-f\d-]+(?:_thumb)?\.(jpg|png|webp)$/.test(key))return new Response('Nie znaleziono.',{status:404});
 const object=await env.BUCKET?.get(key);if(!object)return new Response('Nie znaleziono.',{status:404});
 const headers=new Headers({'Cache-Control':'public,max-age=31536000,immutable','X-Content-Type-Options':'nosniff'});object.writeHttpMetadata(headers);headers.set('etag',object.httpEtag);
 return new Response(object.body,{headers});
}
