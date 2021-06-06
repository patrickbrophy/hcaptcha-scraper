import imghash from "imghash";
import puppeteer from "puppeteer-extra";
import Stealth from "puppeteer-extra-plugin-stealth";
import { createCursor } from "ghost-cursor";
import { writeFile, writeFileSync } from "fs";
import got from "got";
import path from "path";
import EventEmitter from "events";

const findCaptcha = async (page) => {
  await page.waitForSelector(".h-captcha");
  await page.focus(".h-captcha");
};

const findFrame = (frames, frameName) => {
  return frames.filter((f) => f.url().includes(frameName))[0];
};

const sleep = (ms) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

const openCaptcha = async (page) => {
  const frames = await page.frames();
  const checkboxFrame = findFrame(frames, "hcaptcha-checkbox");
  try {
    await checkboxFrame.click("#checkbox");
  } catch (err) {
    await sleep(1000);
    await checkboxFrame.click("#checkbox");
  }
};

const downloadRawImage = async (imageURL) => {
  const { body } = await got(imageURL, {
    responseType: `buffer`,
  });
  return body;
};

const saveImage = (imageBuffer, hash) => {
  writeFileSync(
    process.cwd() + "/images/" + hash + ".jpg",
    imageBuffer,
    (err) => {
      if (err) {
        console.log(err);
        return;
      }
    }
  );
};

const main = async () => {
  puppeteer.use(Stealth());
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  const doneEmitter = new EventEmitter();
  doneEmitter.on("downloadedImage", async (e) => {
    if (e == 18) {
      await browser.close();
    }
  });
  page.on("response", async (e) => {
    if (e.url().includes("getcaptcha")) {
      const body = await e.json();
      let imageCount = 0;
      body.tasklist.forEach(async (t) => {
        const buffer = await downloadRawImage(t.datapoint_uri);
        const hash = await imghash.hash(buffer);
        saveImage(buffer, hash);
        imageCount++;
        doneEmitter.emit("downloadedImage", imageCount);
      });
    }
  });
  await page.goto("https://hcaptcha.com");
  await findCaptcha(page);
  await openCaptcha(page);
};
main();
