import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const transport = new StreamableHTTPClientTransport(new URL('https://bina.et/mcp'));
const client = new Client({ name: 'probe', version: '1.0.0' });
await client.connect(transport);
const tools = await client.listTools();
const sp = tools.tools.find(t => t.name === 'search_properties');
console.log('search_properties schema:', JSON.stringify(sp?.inputSchema).slice(0, 1200));
const res = await client.callTool({ name: 'search_properties', arguments: { area: 'Bole', type: 'APARTMENT', listing: 'sale', limit: 3 } });
console.log('isError:', res.isError);
console.log('contentTypes:', res.content?.map(c => c.type));
const text = res.content?.filter(c => c.type === 'text').map(c => c.text).join('\n');
console.log('RAW (first 3000):');
console.log(text?.slice(0, 3000));
await client.close();
