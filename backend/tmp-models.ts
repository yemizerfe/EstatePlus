import 'dotenv/config';
async function main(){
 const key = process.env.GEMINI_API_KEY!;
 const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
 const j: any = await res.json();
 console.log(res.status, (j.models||[]).map((m:any)=>m.name.replace('models/','')).filter((n:string)=>n.includes('flash')).slice(0,20).join('\n'));
}
main();
