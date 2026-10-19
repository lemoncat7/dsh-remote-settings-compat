import test from 'node:test'
import assert from 'node:assert/strict'
import {withManifestCredentials,hashedAssetCachePolicy} from '../lib/browser-resources.js'
test('manifest includes credentials without changing unrelated or external links',()=>{
 const html='<head><link rel="manifest" href="./manifest.webmanifest"><link rel="stylesheet" href="a.css"></head>'
 const result=withManifestCredentials(html)
 assert.match(result,/href="\.\/manifest.webmanifest" crossorigin="use-credentials"/)
 assert.equal(withManifestCredentials(result),result)
 assert.equal(withManifestCredentials('<link rel="manifest" href="https://other.test/manifest.webmanifest">'),'<link rel="manifest" href="https://other.test/manifest.webmanifest">')
 assert.match(withManifestCredentials("<link crossorigin='anonymous' href='/manifest.webmanifest' rel='manifest' />"),/crossorigin="use-credentials"/)
})
test('only successful hash-named static assets gain private browser caching',()=>{
 const good={'content-type':'text/javascript; charset=utf-8'}
 assert.equal(hashedAssetCachePolicy('GET','/assets/index-CN7NIWNw.js',200,good),'private, max-age=31536000, immutable')
 for(const [method,url,status,headers] of [
  ['POST','/assets/index-CN7NIWNw.js',200,good], ['GET','/assets/index-CN7NIWNw.js',404,good],
  ['GET','/assets/index-CN7NIWNw.js',200,{'content-type':'text/html'}],
  ['GET','/api/session/list',200,good],['GET','/assets/index.js',200,good],
  ['GET','/assets/index-CN7NIWNw.js?token=secret',200,good],
  ['GET','/assets/index-CN7NIWNw.js',200,{...good,'set-cookie':'test'}],
  ['GET','/assets/index-CN7NIWNw.js',200,{...good,'cache-control':'no-store'}],
 ])assert.equal(hashedAssetCachePolicy(method,url,status,headers),undefined)
})
