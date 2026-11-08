const fs=require('fs'),vm=require('vm'),assert=require('assert');
const src=fs.readFileSync('profile.js','utf8'),ctx=vm.createContext({Math,clamp:(x,a,b)=>Math.min(b,Math.max(a,x)),paintBob(){},failBoingRound(){throw Error('Unexpected floor')},requestAnimationFrame:()=>1});
vm.runInContext(src.slice(src.indexOf('const boingGravity'),src.indexOf('const numberFormat'))+src.slice(src.indexOf('function bobClickPoint'),src.indexOf('function clickBob'))+src.slice(src.indexOf('function resolveBobContact'),src.indexOf('function teardownBoing')),ctx);
const fresh=()=>({x:200,y:200,vx:0,vy:0,size:104,spin:0,rotation:0}),close=(a,b,epsilon=1e-8)=>assert(Math.abs(a-b)<epsilon,`${a} != ${b}`);
const power=357.5*1.05*1.05*1.02*1.04,centre=fresh();ctx.applyBobClickImpulse(centre,{x:0,y:0});close(centre.vy,-power);close(centre.vx,0);close(centre.spin,0);
for(const x of [-50,-25,0,25,50])for(const y of [-30,0,30]){
 const s={...fresh(),vx:200,vy:120,spin:450};ctx.applyBobClickImpulse(s,{x,y});close(Math.hypot(s.vx-200,s.vy-120),power);
}
const drop=fresh(),dt=1/120;ctx.advanceBobPhysics(drop,dt,10000,10000);close(drop.vy,1540*.99*dt);close(drop.y,200+1540*.99*dt*dt);
const left=fresh(),right=fresh();ctx.applyBobClickImpulse(left,{x:-35,y:15});ctx.applyBobClickImpulse(right,{x:35,y:15});close(left.vx,-right.vx);close(left.vy,right.vy);close(left.spin,-right.spin);assert(left.spin>0&&right.spin<0);
const falling={...fresh(),vy:200};ctx.applyBobClickImpulse(falling,{x:0,y:0});close(falling.vy,200-power);ctx.applyBobClickImpulse(centre,{x:0,y:0});close(centre.vy,-2*power); // additive momentum, never a random velocity reset
const rotating={...fresh(),spin:500};ctx.applyBobClickImpulse(rotating,{x:15,y:35});const resting=fresh();ctx.applyBobClickImpulse(resting,{x:15,y:35});assert.notEqual(rotating.vx,resting.vx);
const pointScene={...fresh(),arena:{clientLeft:1,clientTop:1,getBoundingClientRect:()=>({left:10,top:20})}};
const hit=ctx.bobClickPoint(pointScene,{detail:1,clientX:10+1+200+52+20,clientY:20+1+200+52-15});close(hit.x,20);close(hit.y,-15);assert.equal(ctx.bobClickPoint(pointScene,{detail:0}).x,0);
const energy=s=>(s.vx*s.vx+s.vy*s.vy+(52*52/2)*(s.spin*Math.PI/180)**2)/2;
for(const [rx,ry,nx,ny,e] of [[-52,0,1,0,.82],[52,0,-1,0,.82],[0,-52,0,1,.72]])for(const tangent of [-300,0,300])for(const spin of [-900,0,900]){
 const s={...fresh(),vx:-nx*400-ny*tangent,vy:-ny*400+nx*tangent,spin},before=energy(s);ctx.resolveBobContact(s,rx,ry,nx,ny,e);assert(energy(s)<=before+1e-7);assert(s.vx*nx+s.vy*ny>0);
}
const wall={...fresh(),x:-1,vx:-300,vy:100};assert(!ctx.advanceBobPhysics(wall,1/120,600,900));assert.equal(wall.x,0);assert(wall.vx>0);assert(wall.spin!==0);
const ceiling={...fresh(),y:-1,vy:-200,vx:100};ctx.advanceBobPhysics(ceiling,1/120,600,900);assert.equal(ceiling.y,0);assert(ceiling.vy>0);assert(ceiling.spin!==0);
const floor={...fresh(),y:790,vy:500};assert(ctx.advanceBobPhysics(floor,1/120,600,900));assert.equal(floor.y,788);
function simulate(fps){const s={...fresh(),running:true,arena:{isConnected:true,clientWidth:10000,clientHeight:10000},last:0,accumulator:0};ctx.applyBobClickImpulse(s,{x:25,y:10});for(let i=1;i<=fps;i++)ctx.stepBoing(s,i*1000/fps);return s}
const reference=simulate(120);for(const fps of [15,30,60,90,144]){const s=simulate(fps);for(const key of ['x','y','vx','vy','spin','rotation'])close(s[key],reference[key],1e-6)}
console.log('PASS: additional +4% impulse, -1% gravity at all hit points, lever torque, existing momentum/spin, screen-space targeting, dissipative contacts, floor and identical 15–144 Hz trajectories');
