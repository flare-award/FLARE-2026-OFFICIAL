// Isolated PostgreSQL; never connects to production.
const fs=require('fs'),vm=require('vm'),assert=require('assert'),{PGlite}=require('@electric-sql/pglite');
(async()=>{const db=new PGlite();try{
const ctx=vm.createContext({});vm.runInContext(fs.readFileSync('data.js','utf8')+';globalThis.squads=nominations.find(n=>n.id==="squad-of-year").nominees',ctx);
assert.equal(ctx.squads.length,5);assert.equal(ctx.squads.find(n=>n.id==='squad-4').name,'Akirakume, Nodben, Rezo1n');
await db.exec("create table flare_options(id text primary key,nomination_id text,kind text,name text);create table flare_votes(option_id text references flare_options(id));insert into flare_options values('squad-4','squad-of-year','group','Akirakume, Awal, Dony_zq, Maronnix, Rezo1n'),('squad-5','squad-of-year','group','Dony_zq, Maronnix, Rezo1n');insert into flare_votes values('squad-4');");
const sql=fs.readFileSync('supabase/migrations/20261108_replace_squad_4_lineup.sql','utf8');await db.exec(sql);await db.exec(sql);
assert.equal((await db.query("select name from flare_options where id='squad-4'")).rows[0].name,ctx.squads.find(n=>n.id==='squad-4').name);
assert.equal((await db.query('select * from flare_votes')).rows[0].option_id,'squad-4');
assert.equal((await db.query("select name from flare_options where id='squad-5'")).rows[0].name,'Dony_zq, Maronnix, Rezo1n');
await db.exec("update flare_options set name='Unexpected' where id='squad-4'");await assert.rejects(db.exec(sql),/Unexpected squad-4/);
console.log('PASS squad-4 replacement, stable ID/vote, unchanged adjacent candidate, idempotence and identity guard');
}finally{await db.close()}})().catch(e=>{console.error(e);process.exit(1)});
