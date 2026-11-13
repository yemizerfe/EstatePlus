import 'dotenv/config';
async function main(){
 const key = process.env.GEMINI_API_KEY;
 console.log('key present', Boolean(key), 'len', key?.length);
 if (!key) return;
 const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${key}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ contents: [{ parts: [{ text: 'Translate to English, reply with the translation only: በቦሌ ሁለት መኝታ አፓርታማ ለሽያጭ' }] }] }),
 });
 console.log('status', res.status, (await res.text()).slice(0, 500));
}
main();
