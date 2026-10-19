import test from 'node:test'
import assert from 'node:assert/strict'
import {watchPageResume} from '../lib/page-resume.js'
test('only a BFCache restoration requests one native reconnect; cleanup removes listener',()=>{
 const win=new EventTarget();let count=0
 const stop=watchPageResume({reconnect(){count++}},win)
 win.dispatchEvent(new Event('focus'));win.dispatchEvent(new Event('pageshow'))
 assert.equal(count,0)
 const event=new Event('pageshow');Object.defineProperty(event,'persisted',{value:true})
 win.dispatchEvent(event);assert.equal(count,1)
 stop();win.dispatchEvent(event);assert.equal(count,1)
})
