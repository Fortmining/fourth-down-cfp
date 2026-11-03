import {sportsRss,privateRssReviewEnabled} from './pulse-rss-policy.ts';
import {newsUrl,type NewsItem,type NewsSource} from './news-pulse.ts';
export function newsCardLink(item:NewsItem,source:NewsSource,now=Date.now()){
 if(item.fixture===true){const url=newsUrl(item.url,source,true);return url&&url===source.home?{url,label:'View sample source',sample:true}:null;}
 const evidence=item.contentEvidence;
 if(!evidence||!Number.isFinite(Date.parse(evidence.verifiedAt))||Date.parse(evidence.verifiedAt)>now||source.permission==='pending')return null;
 const url=newsUrl(item.url,source),verified=newsUrl(evidence.url,source);
 if(!url||url!==verified||url===source.home)return null;
 const target=new URL(url);if(target.pathname==='/'||target.pathname.replace(/\/$/,'')===new URL(source.home).pathname.replace(/\/$/,''))return null;
 if((item.kind==='highlight'||item.kind==='video')&&(source.id==='tennessee-youtube'||source.id.startsWith('yt-'))){if(evidence.resourceType!=='video'||evidence.resourceId!==target.searchParams.get('v'))return null;}
 else if(source.id==='army-news'){if(evidence.resourceType!=='article'||evidence.resourceId!==target.pathname.split('/')[2])return null;}
 else if(source.id==='dvids-editorial'){if(evidence.resourceType!=='video'||evidence.resourceId!==target.pathname.split('/')[2])return null;}
 else if(sportsRss(source.id)){if(!(source.permission==='granted'||(source.permission==='private-review'&&item.privateReview&&privateRssReviewEnabled()))||!evidence.resourceId||evidence.resourceType!==(target.pathname.startsWith('/video/')?'video':'article'))return null;}
 else if(source.id==='kff-news'){if(evidence.resourceType!=='article'||evidence.resourceId!==target.pathname.split('/').filter(Boolean).at(-1))return null;}
 else if(source.permission!=='granted'||evidence.resourceType!=='article'||!evidence.resourceId||!/^\/news\/.*\d{4}[/\-]\d{1,2}[/\-]\d{1,2}\//.test(target.pathname))return null;
 return {url,label:evidence.resourceType==='video'?'Watch original video':'Read original article',sample:false};
}
export function newsCardImage(item:NewsItem,source:NewsSource,now=Date.now()){
 const link=newsCardLink(item,source,now),image=item.image;if(!link||link.sample||!image||!image.attribution||image.contentUrl!==link.url||!Number.isFinite(Date.parse(image.verifiedAt))||Date.parse(image.verifiedAt)>now)return null;
 try{const u=new URL(image.url);if(u.protocol!=='https:'||u.username||u.password||u.port)return null;
  if((source.id==='tennessee-youtube'||source.id.startsWith('yt-'))){
   if(image.permission!=='provider-thumbnail'||u.hostname!=='i.ytimg.com'||!new RegExp('^/vi(?:_webp)?/'+item.contentEvidence!.resourceId+'/').test(u.pathname))return null;
  }else if(image.permission!=='licensed'||!source.imageHosts?.includes(u.hostname))return null;
  return image.url;
 }catch{return null;}
}
