(function(root){
'use strict';
const avatars=['👨🏻‍💻','👩🏻‍💻','👨🏽‍🚀','👩🏽‍🚀','🧑🏻‍🎤','👩🏻‍🎨','🧑🏾‍🚀','🦸🏻‍♂️'];
function fallback(uid){return avatars[String(uid||'').split('').reduce((n,c)=>n+c.charCodeAt(0),0)%avatars.length];}
function jpeg(value,max=12000){return typeof value==='string'&&value.length<=max&&/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(value);}
function source(uid,profile){const saved=avatars.includes(profile.profileAvatar)?profile.profileAvatar:'';return {rankAvatar:saved||fallback(uid),photo:!saved&&jpeg(profile.profilePhotoData,450000)?profile.profilePhotoData:''};}
root.HubRankAvatar={avatars,fallback,jpeg,source};if(typeof module!=='undefined'&&module.exports)module.exports=root.HubRankAvatar;
})(typeof window==='undefined'?globalThis:window);
