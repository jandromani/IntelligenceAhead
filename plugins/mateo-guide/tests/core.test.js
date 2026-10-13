
import test from "node:test";
import assert from "node:assert/strict";
import {listChapters,getPage,planActivity,getMaterials} from "../core.js";
test("Chapters and book page count are verified",()=>{const c=listChapters();assert.equal(c.total_pages,124);assert.equal(c.chapters.length,16);assert.equal(c.chapters.at(-1).page,124);});
test("Page bounds and deep links",()=>{assert.equal(getPage(84).read_url,"https://intelligence-ahead.vercel.app/mateo/leer?p=84");assert.throws(()=>getPage(0));assert.throws(()=>getPage(125));});
test("Age-aware activities do not assert formal certification",()=>{const x=planActivity("algorithms","ages-7-9","5-min");assert.equal(x.instructions.length,3);assert.match(x.note,/no certificada/);assert.equal(planActivity("critical-thinking","adults","15-min").instructions.length,4);});
test("Editorial assets",()=>{const m=getMaterials();assert.match(m.pdf,/pdf$/);assert.match(m.press,/prensa$/);});
