/** Native Cloudflare Worker providers; secret credentials ONLY via Worker secrets. */
export function normalizePhone(raw) {
 const v=String(raw??'').trim();
 if(!/^\+?[\d\s().-]+$/.test(v)||v.slice(1).includes('+'))return '';
 let n=v.replace(/\D/g,'');if(n.startsWith('00'))n=n.slice(2);
 if(/^69\d{8}$/.test(n))n='30'+n;
 if(/^9[4-9]\d{6}$/.test(n))n='357'+n;
 return /^(3069\d{8}|3579[4-9]\d{6})$/.test(n)?n:'';
}
export function senderValid(v){return /^[A-Za-z0-9]{1,11}$/.test(v);}
export function smsEncoding(message){return /^[\u000A\u000D\u0020-\u007E£¥èéùìòÇØøÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ¤¡ÄÖÑÜ§¿äöñüà€]*$/.test(message)?'GSM7':'UCS2';}
let cachedApifon={key:'',token:'',until:0};
async function limitedFetch(url,options,timeout=18000){
 const res=await fetch(url,{...options,redirect:'manual',signal:AbortSignal.timeout(timeout)});
 if(res.status>=300&&res.status<400)throw Error('Provider redirect refused');
 const raw=(await res.text()).slice(0,6000);
 return {status:res.status,raw};
}
export async function sendProvider({provider,phone,sender,message,ref},env){
 try{
  if(provider==='APIFON'){
   if(!env.APIFON_CLIENT_ID||!env.APIFON_CLIENT_SECRET)return {status:'UNCERTAIN',note:'Apifon credentials not configured - no send attempted'};
   const form=new URLSearchParams({grant_type:'client_credentials',client_id:env.APIFON_CLIENT_ID,client_secret:env.APIFON_CLIENT_SECRET,scope:'smsGateway'});
   let auth;
   try{
    const cacheKey=env.APIFON_CLIENT_ID;
    if(cachedApifon.key===cacheKey&&cachedApifon.until>Date.now())auth=cachedApifon.token;
    else{const r=await limitedFetch('https://ids.apifon.com/oauth2/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:form},10000);
    if(r.status!==200)return {status:'FAILED',note:`Apifon OAuth HTTP ${r.status}; no SMS attempt`};
    const obj=JSON.parse(r.raw);auth=obj.access_token;
    if(!auth)return {status:'FAILED',note:'Apifon OAuth token missing; no SMS attempt'};
    cachedApifon={key:cacheKey,token:auth,until:Date.now()+Math.max(60000,Math.min(3300000,(Number(obj.expires_in)||3600)*1000-120000))};}
   }catch{return {status:'FAILED',note:'Apifon OAuth unavailable; no SMS attempt'};}
   const data={subscribers:[{number:phone}],reference_id:ref,message:{text:message,dc:smsEncoding(message)==='UCS2'?2:0,sender_id:sender}};
   const r=await limitedFetch('https://ars.apifon.com/services/api/v1/sms/send',{method:'POST',headers:{authorization:`Bearer ${auth}`,'content-type':'application/json'},body:JSON.stringify(data)});
   if(r.status>=400&&r.status<500)return {status:'FAILED',note:`Apifon HTTP ${r.status}`};
   if(r.status<200||r.status>=300)return {status:'UNCERTAIN',note:`Apifon HTTP ${r.status}`};
   try {const value=JSON.parse(r.raw);const hit=value.results?.[phone]?.[0]?.message_id;
    return hit?{status:'ACCEPTED',providerId:String(hit),note:'Accepted by provider; delivery not confirmed'}:{status:'UNCERTAIN',note:'Apifon no message_id'};
   }catch{return {status:'UNCERTAIN',note:'Unrecognized Apifon response'};}
  }
  if(provider==='MICROSMS'){
   if(!env.MICROSMS_USERNAME||!env.MICROSMS_PASSWORD)return {status:'UNCERTAIN',note:'MicroSMS credentials not configured - no send attempted'};
   const url=new URL('https://api.microsms.net/sendapidirect.asp');
   for(const [k,v] of Object.entries({usr:env.MICROSMS_USERNAME,psw:env.MICROSMS_PASSWORD,mobnu:phone,title:sender,message,Batchid:ref,Dtype:smsEncoding(message)==='UCS2'?'4':'1'}))url.searchParams.set(k,v);
   if(url.href.length>1900)return {status:'FAILED',note:'MicroSMS GET URL would exceed 1900 characters; no attempt'};
   const r=await limitedFetch(url.toString(),{method:'GET'});
   if(r.status>=400&&r.status<500)return {status:'FAILED',note:`MicroSMS HTTP ${r.status}`};
   if(r.status<200||r.status>=300)return {status:'UNCERTAIN',note:`MicroSMS HTTP ${r.status}`};
   const yes=r.raw.trim().match(/^OK(?:\s+([^\s<>]+))?/i);
   if(yes)return {status:'ACCEPTED',providerId:yes[1]||'',note:'Accepted by provider; delivery not confirmed'};
   if(/^Error\b/i.test(r.raw.trim()))return {status:'FAILED',note:'MicroSMS rejected request'};
   return {status:'UNCERTAIN',note:'Unrecognized MicroSMS response'};
  }
  return {status:'FAILED',note:'Unsupported provider; no attempt'};
 }catch{return {status:'UNCERTAIN',note:'Provider request was interrupted. Do not auto retry.'};}
}
