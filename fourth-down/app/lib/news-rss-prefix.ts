/** Read only a bounded RSS prefix; cancel transport after complete item boundaries.
 * CDATA/comments are skipped so embedded closing-tag text cannot fabricate items. */
export async function rssMetadataPrefix(response:Response,maxBytes=512*1024,maxItems=10){
 if(!Number.isInteger(maxBytes)||maxBytes<1||maxBytes>512*1024||!Number.isInteger(maxItems)||maxItems<1||maxItems>20||!response.body)throw Error('Feed size limit');
 const reader=response.body.getReader(),decoder=new TextDecoder('utf-8',{fatal:true});let value='',bytes=0,scan=0,items=0,inside=false;
 try{for(;;){const chunk=await reader.read();if(chunk.done)return value+decoder.decode();bytes+=chunk.value.byteLength;if(bytes>maxBytes)throw Error('Feed size limit');value+=decoder.decode(chunk.value,{stream:true});if(/<!DOCTYPE|<!ENTITY/i.test(value))throw Error('Unsafe or oversized feed');
  for(;;){const at=value.indexOf('<',scan);if(at<0)break;const tail=value.slice(at);if(tail.startsWith('<![CDATA[')||tail.startsWith('<!--')){const marker=tail.startsWith('<!--')?'-->':']]>',end=value.indexOf(marker,at+3);if(end<0)break;scan=end+marker.length;continue;}if(tail.length<10&&!tail.includes('>'))break;const end=value.indexOf('>',at);if(end<0)break;const tag=value.slice(at,end+1);if(/^<item(?:\s|>)/.test(tag)){if(inside)throw Error('Unbalanced XML');inside=true;}else if(/^<\/item\s*>$/.test(tag)){if(!inside)throw Error('Unbalanced XML');inside=false;if(++items===maxItems){const prefix=value.slice(0,end+1);if(!/<rss[\s>]/.test(prefix)||!/<channel[\s>]/.test(prefix))throw Error('Unsupported feed');return prefix+'</channel></rss>';}}scan=end+1;}
 }}finally{await reader.cancel();}
}
