import test from 'node:test';
import assert from 'node:assert/strict';
import { suggestProducts } from '../app/lib/whatsappProductSearch.mjs';
const products = [{id:'1',sku:'123',name:'Стол из нержавеющей стали',url:'https://horecalink.kz/products/table',specs:''},{id:'2',sku:'1234',name:'Мойка',url:'https://horecalink.kz/products/sink',specs:''}];
test('exact product links, SKU boundaries, Turkish aliases and no match',() => {
  assert.equal(suggestProducts(products,'https://horecalink.kz/products/sink')[0].id,'2');
  assert.equal(suggestProducts(products,'1234 fiyatı')[0].id,'2');
  assert.equal(suggestProducts(products,'paslanmaz masa')[0].id,'1');
  assert.equal(suggestProducts(products,'merhaba').length,0);
});
