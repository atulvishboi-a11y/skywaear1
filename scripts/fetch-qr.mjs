import fs from 'node:fs';
import path from 'node:path';
import QRCode from 'qrcode';

async function main() {
  const artifactDir = 'C:\\Users\\vishw\\.gemini\\antigravity-ide\\brain\\185f0de0-32a6-44d0-bf88-c0b883796dd2';
  const outPath = path.join(artifactDir, 'whatsapp_qr.png');

  console.log('Connecting to https://zenin-whatsapp.onrender.com/sse ...');
  const res = await fetch('https://zenin-whatsapp.onrender.com/sse');
  const reader = res.body.getReader();
  const decoder = new TextDecoder();

  let qrRaw = null;
  const timeout = Date.now() + 20000;

  while (Date.now() < timeout) {
    const { value, done } = await reader.read();
    if (done) break;
    const text = decoder.decode(value);
    console.log('Received chunk:', text.trim());

    const lines = text.split('\n');
    for (const line of lines) {
      if (line.startsWith('data:')) {
        try {
          const jsonStr = line.replace('data:', '').trim();
          const parsed = JSON.parse(jsonStr);
          if (parsed && parsed.qr && parsed.qr.length > 10) {
            qrRaw = parsed.qr;
            break;
          }
        } catch {}
      }
    }
    if (qrRaw) break;
  }

  if (!qrRaw) {
    console.error('Could not obtain QR from SSE stream within timeout');
    process.exit(1);
  }

  console.log('Got QR string:', qrRaw.substring(0, 30) + '...');
  await QRCode.toFile(outPath, qrRaw, {
    width: 400,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#ffffff',
    },
  });

  console.log('Successfully saved QR to:', outPath);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
