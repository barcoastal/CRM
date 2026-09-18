import {describe,it,expect} from 'vitest';
import {hasSameOrigin} from '../../src/lib/request-origin';
describe('reverse-proxy request origin',()=>{
  it('accepts the public host when Next sees an internal URL',()=>{
    expect(hasSameOrigin(new Request('http://localhost:8080/api/leads/id/viewed',{headers:{origin:'https://crm.example.com',host:'crm.example.com'}}))).toBe(true);
    expect(hasSameOrigin(new Request('http://localhost:8080/api/leads/id/viewed',{headers:{origin:'https://crm.example.com',host:'localhost:8080','x-forwarded-host':'crm.example.com'}}))).toBe(true);
  });
  it('rejects cross-origin and malformed browser origins',()=>{
    for(const origin of ['https://other.example.com','null','broken'])expect(hasSameOrigin(new Request('https://crm.example.com/api/leads/id/viewed',{headers:{origin}}))).toBe(false);
  });
  it('accepts a direct same-origin request',()=>{
    expect(hasSameOrigin(new Request('https://crm.example.com/api/leads/id/viewed',{headers:{origin:'https://crm.example.com'}}))).toBe(true);
  });
});
