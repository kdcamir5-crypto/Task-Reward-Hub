/* Delete expired task definitions only. Submissions and money receipts are retained. */
async function cleanupDailyTasks(db,{now=Date.now(),limit=200}={}){
 const snap=await db.collection('tasks').where('expiresAtMs','<=',now).limit(limit).get();
 let deleted=0;
 for(const doc of snap.docs){
  const removed=await db.runTransaction(async tx=>{
   const current=await tx.get(doc.ref);if(!current.exists)return false;
   const d=current.data();if(d.schemaVersion!==2||!Number.isSafeInteger(d.expiresAtMs)||d.expiresAtMs>now)return false;
   tx.delete(doc.ref);return true;
  });if(removed)deleted++;
 }
 return {examined:snap.size,deleted};
}
module.exports={cleanupDailyTasks};
