// Temporary diagnostic: scan session logs for vision-image vs core image blocks.
import { readFileSync } from 'node:fs'
import { scanZstdFrames } from 'file:///D:/AI/DeepSeekHarness/deepseek-harness/packages/session/session-persistence-jsonl/src/zstd.ts'
import { PublicZstdFrameDecoder } from 'file:///D:/AI/DeepSeekHarness/deepseek-harness/packages/session/session-persistence-jsonl/src/zstd-public-decoder.ts'

const log = process.argv[2]
const buf = readFileSync(log)
const scan = scanZstdFrames(buf)
const decoder = new PublicZstdFrameDecoder()
let text = ''
for (const piece of decoder.decode(buf, scan.frames)) text += piece.toString('utf8')
const lines = text.split('\n').filter(Boolean)
let visionImage = 0
let coreImage = 0
const visionRefs = new Set()
for (const line of lines) {
  const ev = JSON.parse(line)
  const s = JSON.stringify(ev)
  if (s.includes('vision-image')) {
    visionImage++
    const m = s.match(/"attachmentId":"([0-9a-f-]+)"/)
    if (m) visionRefs.add(m[1])
  }
  if (s.includes('"type":"image"')) coreImage++
}
console.log('log:', log)
console.log('events with vision-image:', visionImage)
console.log('events with core image type:', coreImage)
console.log('distinct vision attachmentIds:', visionRefs.size, [...visionRefs].slice(0, 5).join(','))
